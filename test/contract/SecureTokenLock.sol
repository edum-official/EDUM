// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20; // Ensure using the latest Solidity version

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SecureTokenLock is Ownable, ReentrancyGuard {
    IERC20 public immutable token;

    struct LockInfo {
        uint256 amount;
        uint256 releaseTime;
    }

    mapping(address => LockInfo[]) private _lockedTokens;
    mapping(address => uint256) private _lastUnlockTimestamp; // Rate limit for DoS prevention
    mapping(address => uint256) private _lastLockTimestamp; // 🔥 Prevent frequent lock calls (DoS protection)
    mapping(address => bool) private _approvedUsers; // 🔥 Approved user list

    uint256 public constant MIN_LOCK_DURATION = 1 minutes;
    uint256 public constant MAX_LOCK_DURATION = 10 * 365 days; // Maximum lock duration: 10 years
    uint256 public constant LOCK_COOLDOWN = 30 seconds; // 🔥 Cooldown to prevent rapid lock spamming

    event TokensLocked(address indexed user, uint256 amount, uint256 releaseTime);
    event TokensUnlocked(address indexed user, uint256 amount);
    event AdminUnlock(address indexed admin, address indexed user, uint256 amount);
    event UserApproved(address indexed user, bool isApproved);

    constructor(address _tokenAddress) {
        require(_tokenAddress != address(0), "Invalid token address");
        token = IERC20(_tokenAddress);

        // Verify ERC-20 compliance
        try token.totalSupply() returns (uint256) {
        } catch {
            revert("Token does not conform to ERC-20 standard");
        }
    }

    /// @dev Approve or revoke a user's lock/unlock privileges (Admin only)
    function approveUser(address user, bool isApproved) external onlyOwner {
        _approvedUsers[user] = isApproved;
        emit UserApproved(user, isApproved);
    }

    /// @dev Allows users to lock tokens (must be approved first)
    function lockTokens(uint256 amount, uint256 durationInSeconds) external nonReentrant {
        require(amount > 0, "Lock amount must be greater than 0");
        require(durationInSeconds >= MIN_LOCK_DURATION, "Lock duration too short");
        require(durationInSeconds <= MAX_LOCK_DURATION, "Lock duration too long");

        // 🔥 Prevent frequent lock calls (DoS protection)
        require(block.timestamp >= _lastLockTimestamp[msg.sender] + LOCK_COOLDOWN, "Lock cooldown active");
        _lastLockTimestamp[msg.sender] = block.timestamp;

        // 🔥 Ensure new locks don’t overlap with existing ones for better efficiency
        _autoUnlock(msg.sender);

        require(token.allowance(msg.sender, address(this)) >= amount, "Approve required");

        uint256 releaseTime = block.timestamp + durationInSeconds;
        _lockedTokens[msg.sender].push(LockInfo(amount, releaseTime));

        // 🔥 Secure token transfer with error handling
        try token.transferFrom(msg.sender, address(this), amount) returns (bool success) {
            require(success, "Token transfer failed");
        } catch {
            revert("Token transfer failed: Possible ERC-20 incompatibility");
        }

        emit TokensLocked(msg.sender, amount, releaseTime);
    }

    /// @dev Returns the total amount of locked tokens for a specific address
    function lockedBalanceOf(address user) public view returns (uint256 totalLocked) {
        LockInfo[] storage locks = _lockedTokens[user];
        for (uint256 i = 0; i < locks.length; i++) {
            if (block.timestamp < locks[i].releaseTime) {
                totalLocked += locks[i].amount;
            }
        }
    }

    /// @dev Returns the actual available balance for a specific address
    function availableBalanceOf(address user) public view returns (uint256) {
        return token.balanceOf(user) - lockedBalanceOf(user);
    }

    /// @dev Automatically unlocks tokens before allowing transfers (Prevents reentrancy attacks)
    function transfer(address recipient, uint256 amount) external nonReentrant {
        _autoUnlock(msg.sender); // 🔥 Automatically unlock before transferring

        require(token.balanceOf(address(this)) >= amount, "Contract has insufficient tokens");

        // 🔥 Secure token transfer with error handling
        try token.transfer(recipient, amount) returns (bool success) {
            require(success, "Transfer failed");
        } catch {
            revert("Token transfer failed: Possible ERC-20 incompatibility");
        }
    }

    /// @dev Checks and unlocks all eligible tokens for a user (Prevents reentrancy attacks)
    function _autoUnlock(address user) internal nonReentrant {
        uint256 unlockedAmount = 0;
        LockInfo[] storage locks = _lockedTokens[user];

        for (uint256 i = 0; i < locks.length; ) {
            if (block.timestamp >= locks[i].releaseTime) {
                unlockedAmount += locks[i].amount;
                locks[i] = locks[locks.length - 1];
                locks.pop();
            } else {
                i++;
            }
        }

        if (unlockedAmount > 0) {
            require(token.balanceOf(address(this)) >= unlockedAmount, "Contract has insufficient tokens");

            // 🔥 Secure token transfer with error handling
            try token.transfer(user, unlockedAmount) returns (bool success) {
                require(success, "Token transfer failed");
            } catch {
                revert("Token transfer failed: Possible ERC-20 incompatibility");
            }

            emit TokensUnlocked(user, unlockedAmount);
        }
    }

    /// @dev Allows users to manually unlock tokens (Rate limit added)
    function manualUnlock() external nonReentrant {
        require(_approvedUsers[msg.sender], "User is not approved for unlocking");
        require(block.timestamp >= _lastUnlockTimestamp[msg.sender] + 1 minutes, "Unlock rate limited");
        _lastUnlockTimestamp[msg.sender] = block.timestamp;
        _autoUnlock(msg.sender);
    }

    /// @dev Allows the admin to force unlock a user's tokens (Admin only)
    function adminUnlock(address user) external onlyOwner nonReentrant {
        require(_approvedUsers[user], "User is not approved for unlocking");
        _autoUnlock(user);
        emit AdminUnlock(msg.sender, user, lockedBalanceOf(user));
    }
}