// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EDUM is ERC20, Ownable {
    // Initial totalSupply
    uint256 private constant TOTAL_SUPPLY = 2000000000;

    /**
     * @dev transferWithLocked function can only be called by a controller 
     */
    modifier onlyController {
        require(isController[_msgSender()]);
        _;
    }

    /**
     * @dev Lockup event 
     * @param addr 수신 주소 
     * @param amount Lockup 수량
     * @param timestamp Release 시간
     *        isListed == true  -> 절대 시간
     *        isListed == false -> listingDate 상대 시간   간 
     * @param isListed transferPreTimelock(상장 전), transferTimelock(상장 후) 구분
     */   
    event Locked(address indexed addr, uint256 amount, uint timestamp, bool isListed);
    
    /**
     * @dev Lising event 
     * @param timestamp Listing Date
     */   
    event Listing(uint timestamp);

    /**
     * @dev Specify the lockup quantity and release time. 
     * @dev Lockup Lockup quantity 
     * @dev releaseTime Release time
     */
    struct TokenLockInfo {
        uint256 amount;                 // locked amount
        uint256 releaseTime;            // unix timestamp
    }

    /**
     * @dev Account 별 Lockup 정보 저장 
     * @dev minReleaeTime lockInfo 리스트 중 가장 작은 releaseTime 값.
     *      transferPreTimelock 함수 호출 시에는 0 으로 세팅 됨. (_refactoringPreTimelock 세팅 됨) 
     *      transferTimeLock 호출 시에는 값이 세팅 됨
     * @dev lockInfo TokenLockInfo 배열
     */
    struct TokenLockState {
        uint256 minReleaseTime;
        TokenLockInfo[] lockInfo;     // Multiple token locks can exist
    }

    // mapping for TokenLockState 
    mapping(address => TokenLockState) public lockStates;

    // Mapping from controllers to controller status.
    mapping(address => bool) internal isController;

    // Array of controllers.
    address[] internal controllers;  

    // 상장 일 
    uint256 listingDate = 0;

    /**
     * @dev Initialize EDUM.
     *      총 발행량은 20억개 (추가 상장 불가)
     */
    constructor() ERC20('EDUM', 'EDUM') {
        _mint(_msgSender(), TOTAL_SUPPLY*10**decimals());
    }

    /**
     * @dev 상장일 설정. 한번만 불릴 수 있음 
     *      transferPreTimelock 의 ReleaseTime 이 확정 됨
     * @param _listingDate 상장일
     */
    function setListingDate(uint _listingDate) external onlyOwner {
        require(listingDate == 0, "listingDate already set");

        // listingDate = block.timestamp;
        if (_listingDate == 0) {
            listingDate = block.timestamp;
        } else {
            listingDate = _listingDate;
        }

        emit Listing(listingDate);
    }

    /**
     * @dev Get listingDate 
     * @return listingDate Date of listing
     */
    function getListingDate() public view returns(uint256) {
        return listingDate;
    }

    /**
     * @dev Set list of controllers.
     * @param controllerList List of controller addresses.
     */
    function setControllers(address[] memory controllerList) public onlyOwner {
        uint ii;
        for (ii = 0; ii < controllers.length; ii++) {
            isController[controllers[ii]] = false;
        }
        for (ii = 0; ii < controllerList.length; ii++) {
            isController[controllerList[ii]] = true;
        }
        controllers = controllerList;
    }    

    /**
     * @dev Get list of controllers.
     * @return List of address of all the controllers.
     */
    function getControllers() public view returns(address[] memory) {
        return controllers;
    }    

    /**
     * @dev don't send eth directly to token contract 
     */
    receive() external payable {
        revert("Don't accept ETH");
    }

   /**
    * @dev transferPreTimelock 으로 추가 된 Lockup ReleaseTime 정보를 세팅.
    *      _beforeTransfer / transferTimelock 에서 호출. 
    * @param _addr address.
    */
    function _refactoringPreTimelock(address _addr) internal {
        uint length = lockStates[_addr].lockInfo.length;
        // transferPreTimelock 호출이 된 상태 && 상장 후 첫번째 호출 시에만 진행 됨. 
        if ((length > 0) &&                                 // 처리할 내용이 있는가
            (lockStates[_addr].minReleaseTime == 0) &&      // transferPreTimelock 인가 & 이미 처리가 되었는가  
            (listingDate > 0))                              // 상장된 상태인가
        {
            uint releaseTime;
            for (uint ii = 0; ii < length; /* unchecked inc */) {
                releaseTime = lockStates[_addr].lockInfo[ii].releaseTime + listingDate; 
                lockStates[_addr].lockInfo[ii].releaseTime = releaseTime; 
                if (lockStates[_addr].minReleaseTime == 0 || lockStates[_addr].minReleaseTime > releaseTime) {
                   lockStates[_addr].minReleaseTime = releaseTime; 
                }
                unchecked {
                    ii++;
                }
            }
        }
    }

   /**
    * @dev Release 된 Lock 정보를 삭제 
    * @param _addr address.
    */
    function _releaseLockInfo(address _addr) internal {
        uint256 lockCount = 0;
        uint256 lockLength;

        // 상장이 되지 않은 상태에서는 Release 될 Lock 정보는 없음. 
        if (listingDate==0) return;

        // transferPreTimelock 정보 refactoring 
        _refactoringPreTimelock(_addr);

        // 현재 시점에서 Release 할 Lock 정보는 없음.
        if (lockStates[_addr].minReleaseTime > block.timestamp) return;

        lockStates[_addr].minReleaseTime = 0;
        lockLength = lockStates[_addr].lockInfo.length; 
        for (uint256 ii = 0; ii < lockLength; /* unchecked inc */) {
            // 아직 Release 시간이 되지 않은 상태 이면 남겨둔다.
            if (lockStates[_addr].lockInfo[ii].releaseTime > block.timestamp) {   
                // Update minReleaseTime
                if ((lockStates[_addr].minReleaseTime == 0) || 
                    (lockStates[_addr].minReleaseTime > lockStates[_addr].lockInfo[ii].releaseTime)) 
                {
                    lockStates[_addr].minReleaseTime = lockStates[_addr].lockInfo[ii].releaseTime;
                }
                lockStates[_addr].lockInfo[lockCount] = lockStates[_addr].lockInfo[ii];
                unchecked {
                    lockCount++;
                }
            }
            unchecked {
                ii++;
            }
        }

        if (lockCount == 0) {
            // 모든 Lock 정보가 삭제되었을 경우 
            delete lockStates[_addr];
        } else {
            // 삭제된 Lock 정보 수 만큰 Pop 
            uint256 removeCount = lockStates[_addr].lockInfo.length - lockCount;            
            for (uint256 ii = 0; ii < removeCount; /* unchecked inc */) {
                lockStates[_addr].lockInfo.pop();
                unchecked {
                    ii++;
                }
            }
        }
    }

  /**
   * @dev Get the amount of locked tokens 
   * @param _addr address.
   * @return totalLocked Amount of locked tokens.
   */
    function getLockedBalance(address _addr) public view returns (uint256) {
        uint256 totalLocked = 0;
        uint256 lockLength;
        uint256 releaseTime;

        lockLength = lockStates[_addr].lockInfo.length; 
        for (uint256 ii = 0; ii < lockLength; /* unchecked inc */) {
            if (listingDate == 0) {
                // 아직 상장이 되지 않은 상태이면 무조건 Lock 상태
                totalLocked += lockStates[_addr].lockInfo[ii].amount;
            } else {
                releaseTime = lockStates[_addr].lockInfo[ii].releaseTime;
                // 상장 후 _refactoringPreTimelock 이 호출되지 않았을 경우 listingDate 기준으로 ReleaseTime 계산
                if (lockStates[_addr].minReleaseTime == 0) {
                    releaseTime += listingDate;
                }

                if (releaseTime > block.timestamp) {
                    totalLocked += lockStates[_addr].lockInfo[ii].amount;
                }
            }
            unchecked {
                ii++;
            }
        }

        return totalLocked;
    }

   /**
    * @dev Hook that is called before any transfer of tokens. 
    * @param from The address to transfer from.
    * @param to The address to transfer to.
    * @param amount The amount to be transferred.
    */
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        super._beforeTokenTransfer(from, to, amount);

        // Release 되어야 할 Lock 정보 삭제
        _releaseLockInfo(from);

        if (from != address(0)) {       // Skip when mint
            uint256 locked = getLockedBalance(from);
            uint256 accountBalance = balanceOf(from);
            require(accountBalance - locked >= amount, "Transfer amount exeeds balance or some amounts are locked.");
        }
    }

   /**
    * @dev 토큰 Lock 전송. 상장 후 호출 가능. 
    * @param _addr The address to transfer to.
    * @param _amount The amount to be transferred.
    * @param _releaseTime The timestamp to unlock token.
    * @return The result of transferTimelock
    */
    function transferTimelock(address _addr, uint256[] memory _amount, uint256[] memory _releaseTime)
        external
        onlyController
        returns(bool)
    {
        require(listingDate > 0, "Token is not listed");
        return _transferTimelock(_addr, _amount, _releaseTime);
    }

   /**
    * @dev 토큰 Lock 전송. 상장 전 호출 가능. 
    * @param _addr The address to transfer to.
    * @param _amount The amount to be transferred.
    * @param _releaseTime The timestamp to unlock token.
    * @return The result of transferPreTimelock
    */
    function transferPreTimelock(address _addr, uint256[] memory _amount, uint256[] memory _releaseTime)
        external
        onlyController
        returns(bool)
    {
        require(listingDate == 0, "Token is listed");
        return _transferTimelock(_addr, _amount, _releaseTime);
    }

   /**
    * @dev 토큰 Lock 전송
    * @param _addr The address to transfer to.
    * @param _amount The amount to be transferred.
    * @param _releaseTime The timestamp to unlock token.
    * @return The result of transferTimelock
    */
    function _transferTimelock(address _addr, uint256[] memory _amount, uint256[] memory _releaseTime) 
        internal
        onlyController 
        returns (bool)
    {
        require(_amount.length == _releaseTime.length, "amount and releaeTime must have save length");

        uint ii;
        uint256 totalAmount = 0;
        uint256 amountLength = 0;

        // transferPreTimelock 정보가 있을 경우 Release 정보 업데이트
        _refactoringPreTimelock(_addr);

        amountLength = _amount.length; 
        for (ii = 0; ii < amountLength; /* unchecked inc */) {
            totalAmount += _amount[ii]; 

            // Add lockInfo
            lockStates[_addr].lockInfo.push(TokenLockInfo(_amount[ii], _releaseTime[ii]));

            // If token is listed, update minReleaseTime
            if (listingDate > 0) {
                if ((lockStates[_addr].minReleaseTime == 0) || (lockStates[_addr].minReleaseTime > _releaseTime[ii])) {
                    lockStates[_addr].minReleaseTime = _releaseTime[ii];
                }
            }
            emit Locked(_addr, _amount[ii], _releaseTime[ii], listingDate>0);

            unchecked {
                ii++;
            }
        }

        transfer(_addr, totalAmount);

        return true;
    }

   /**
    * @dev 계정별 TokenLockState 정보 리턴 
    * @param _addr address
    * @return The TokenLockState of _addr
    */
    function getTokenlockStates(address _addr) external view returns(TokenLockState memory) {
        return lockStates[_addr];
    }

   /**
    * @dev Multiple transfer function (onlyOwner)
    * @param _to address list 
    * @param _amount amount list 
    */
    function multiTransfer(address[] memory _to, uint256[] memory _amount) external onlyOwner {
        uint transferCount = _to.length;

        require(_to.length == _amount.length, "to and amount must have save length");

        for (uint ii = 0; ii < transferCount; ) {
            transfer(_to[ii], _amount[ii]);
            unchecked {
                ii++;
            }
        }
    }

   /**
    * @dev Destroy amount of tokens from account 
    * @dev Reduce totalSupply 
    * @dev A locked amount of token cannot be burned. 
    * @param _amount Amount to burn 
    */
    function burn(uint256 _amount) external {
        _burn(_msgSender(), _amount);
    }

    /*
    /////////////////////////////////
    // for test
    /////////////////////////////////
    function getLockedCount(address _account) public view returns (uint) {
        return lockStates[_account].lockInfo.length;
    }

    event Dummy(uint value);
    function dummy() public {
        emit Dummy(0);
    }
    */
}