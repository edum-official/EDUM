// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SecureTokenLock is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    IERC20 public immutable token;

    struct LockInfo {
        uint256 amount;
        uint256 releaseTime;
    }
    
    address[] private approvedUserList;

    mapping(address => LockInfo[]) private _lockedTokens;
    mapping(address => uint256) private _totalLockedBalance;
    mapping(address => uint256) private _lastUnlockTimestamp;
    mapping(address => uint256) private _lastLockTimestamp;
    mapping(address => bool) private _approvedUsers;
    mapping(address => uint256) public pendingAdminUnlocks;
    mapping(address => uint256) private _nextUnlockIndex;

    uint256 public constant MIN_LOCK_DURATION = 1 minutes;
    uint256 public constant MAX_LOCK_DURATION = 10 * 365 days;
    uint256 public constant LOCK_COOLDOWN = 30 seconds;
    uint256 public constant ADMIN_UNLOCK_DELAY = 24 hours;

    event TokensLocked(address indexed user, uint256 amount, uint256 releaseTime);
    event TokensUnlocked(address indexed user, uint256 amount);
    event AdminUnlockRequested(address indexed admin, address indexed user, uint256 unlockTime);
    event AdminUnlockCompleted(address indexed admin, address indexed user, uint256 amount);
    event AdminUnlockCancelled(address indexed admin, address indexed user);
    event UserApproved(address indexed user, bool isApproved);

    constructor(address _tokenAddress) {
        require(_tokenAddress != address(0), "Invalid token address");
        token = IERC20(_tokenAddress);
    }

    function approveUser(address user, bool isApproved) external onlyOwner {
        require(_approvedUsers[user] != isApproved, "No state change");
        _approvedUsers[user] = isApproved;

        if (isApproved) {
            approvedUserList.push(user);
        } else {
            for (uint256 i = 0; i < approvedUserList.length; i++) {
                if (approvedUserList[i] == user) {
                    approvedUserList[i] = approvedUserList[approvedUserList.length - 1];
                    approvedUserList.pop();
                    break;
                }
            }
        }

        emit UserApproved(user, isApproved);
    }

    function getApprovedUsers() external view returns (address[] memory) {
        // return approvedUserList;
        uint256 count = 0;
        address[] memory tempList = new address[](approvedUserList.length);

        for (uint256 i = 0; i < approvedUserList.length; i++) {
            if (_approvedUsers[approvedUserList[i]]) {
                tempList[count] = approvedUserList[i];
                count++;
            }
        }

        // 크기에 맞는 새 배열 생성하여 반환
        address[] memory activeUsers = new address[](count);
        for (uint256 j = 0; j < count; j++) {
            activeUsers[j] = tempList[j];
        }

        return activeUsers;
    }

    function lockTokens(uint256 amount, uint256 durationInSeconds) external nonReentrant {
        require(_approvedUsers[msg.sender], "User is not approved");
        require(amount > 0, "Lock amount must be greater than 0");
        require(durationInSeconds >= MIN_LOCK_DURATION && durationInSeconds <= MAX_LOCK_DURATION, "Invalid lock duration");
        require(block.timestamp >= _lastLockTimestamp[msg.sender] + LOCK_COOLDOWN, "Lock cooldown active");

        //  사용 가능한 잔액 확인 (이미 잠긴 토큰 제외)
        uint256 availableBalance = token.balanceOf(msg.sender) - lockedBalanceOf(msg.sender);
        require(availableBalance >= amount, "Insufficient available balance");

        _lastLockTimestamp[msg.sender] = block.timestamp;

        //  Allowance 체크
        require(token.allowance(msg.sender, address(this)) >= amount, "Insufficient allowance");


        //  **Fix: Check if user has enough balance before locking** 
        // require(token.balanceOf(msg.sender) >= amount, "Insufficient balance");
        require(token.allowance(msg.sender, address(this)) >= amount, "Insufficient allowance");

        uint256 initialBalance = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 finalBalance = token.balanceOf(address(this));
        uint256 receivedAmount = finalBalance - initialBalance;

        require(receivedAmount == amount, "Unexpected token transfer issue");
        require(receivedAmount > 0, "Token transfer failed or taxed");

        _lockedTokens[msg.sender].push(LockInfo(receivedAmount, block.timestamp + durationInSeconds));
        _totalLockedBalance[msg.sender] += receivedAmount;
        
        emit TokensLocked(msg.sender, receivedAmount, block.timestamp + durationInSeconds);
    }

    function lockedBalanceOf(address user) public view returns (uint256) {
        // return _totalLockedBalance[user];
        uint256 lockedAmount = _totalLockedBalance[user];

        // 자동으로 해제할 수 있는 금액을 계산
        uint256 unlockedAmount = 0;
        LockInfo[] storage locks = _lockedTokens[user];

        for (uint256 i = _nextUnlockIndex[user]; i < locks.length; i++) {
            if (block.timestamp >= locks[i].releaseTime) {
                unlockedAmount += locks[i].amount;
            } else {
                break; // 더 이상 언락 가능한 것이 없음
            }
        }

        //  음수 값 방지 (lockedAmount가 unlockedAmount보다 작아지는 경우)
        return lockedAmount > unlockedAmount ? lockedAmount - unlockedAmount : 0;
    }

    function _autoUnlock(address user) internal nonReentrant {
        uint256 unlockedAmount = 0;
        LockInfo[] storage locks = _lockedTokens[user];
        uint256 i = _nextUnlockIndex[user];
        uint256 maxUnlocksPerTx = 5;
        uint256 unlockCount = 0;

        while (i < locks.length && block.timestamp >= locks[i].releaseTime && unlockCount < maxUnlocksPerTx) {
            unlockedAmount += locks[i].amount;
            i++;
            unlockCount++;
        }
        
        if (unlockedAmount > 0) {
            // _totalLockedBalance[user] -= unlockedAmount;
            _totalLockedBalance[user] = _totalLockedBalance[user] > unlockedAmount ? _totalLockedBalance[user] - unlockedAmount : 0;

            //  _nextUnlockIndex[user] 검증 추가
            if (i >= locks.length) {
                _nextUnlockIndex[user] = locks.length; // 모든 잠금 해제 시 마지막 인덱스로 설정
            } else {
                _nextUnlockIndex[user] = i;
            }

            //  `_lockedTokens[user]` 배열에서 해제된 항목 삭제
            for (uint256 j = 0; j < unlockCount; j++) {
                _lockedTokens[user].pop();
            }

            require(token.balanceOf(address(this)) >= unlockedAmount, "Insufficient contract balance");

            // 상태 변경 후 외부 호출 실행 (Checks-Effects-Interactions 패턴)
            token.safeTransfer(user, unlockedAmount);
            emit TokensUnlocked(user, unlockedAmount);
        }

        // _nextUnlockIndex[user] = (i < locks.length) ? i : 0;
        _nextUnlockIndex[user] = (i < _lockedTokens[user].length) ? i : _lockedTokens[user].length;
    }

    function manualUnlock() external nonReentrant {
        require(_approvedUsers[msg.sender], "User not approved");
        require(block.timestamp >= _lastUnlockTimestamp[msg.sender] + 1 minutes, "Unlock rate limited");

        _lastUnlockTimestamp[msg.sender] = block.timestamp;
        _autoUnlock(msg.sender);
    }

    function requestAdminUnlock(address user) external onlyOwner {
        require(_approvedUsers[user], "User not approved");
        require(pendingAdminUnlocks[user] == 0, "Unlock request already exists"); //  중복 요청 방지

        pendingAdminUnlocks[user] = block.timestamp;
        emit AdminUnlockRequested(msg.sender, user, block.timestamp + ADMIN_UNLOCK_DELAY);
    }

    function cancelAdminUnlock(address user) external onlyOwner {
        require(pendingAdminUnlocks[user] > 0, "No pending unlock request");
        pendingAdminUnlocks[user] = 0;
        emit AdminUnlockCancelled(msg.sender, user);
    }

    function adminUnlock(address user) external onlyOwner nonReentrant {
        require(_approvedUsers[user], "User not approved");
        require(pendingAdminUnlocks[user] > 0, "No pending unlock request");
        require(block.timestamp >= pendingAdminUnlocks[user] + ADMIN_UNLOCK_DELAY, "Unlock delay not met");

        pendingAdminUnlocks[user] = 0;
        _autoUnlock(user);
        emit AdminUnlockCompleted(msg.sender, user, lockedBalanceOf(user));
    }

    function transfer(address recipient, uint256 amount) external nonReentrant {
        // _autoUnlock(msg.sender);
        uint256 lockedBefore = _totalLockedBalance[msg.sender];

        //  잠긴 금액이 0보다 크면 자동 언락 수행
        if (lockedBefore > 0) {
            _autoUnlock(msg.sender);
        }

        // uint256 updatedLockedBalance = lockedBalanceOf(msg.sender);
        uint256 updatedLockedBalance = _totalLockedBalance[msg.sender];
        uint256 availableBalance = token.balanceOf(msg.sender) - updatedLockedBalance;
        
        require(availableBalance >= amount, "Cannot transfer locked tokens");
        token.safeTransfer(recipient, amount);
    }
}
