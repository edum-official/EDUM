// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts@4.9.3/token/ERC20/IERC20.sol";

contract TokenLock {
    IERC20 public token;
    struct Lock {
        uint256 amount;
        uint256 releaseTime;
    }
    
    mapping(address => Lock) public lockedTokens;
    
    constructor(IERC20 _token) {
        token = _token;
    }
    
    function lockTokens(uint256 _amount, uint256 _lockDuration) external {
        require(lockedTokens[msg.sender].amount == 0, "Tokens already locked");
        token.transferFrom(msg.sender, address(this), _amount);
        lockedTokens[msg.sender] = Lock(_amount, block.timestamp + _lockDuration);
    }
    
    function withdrawTokens() external {
        require(block.timestamp >= lockedTokens[msg.sender].releaseTime, "Lockup not expired");
        uint256 amount = lockedTokens[msg.sender].amount;
        lockedTokens[msg.sender].amount = 0;
        token.transfer(msg.sender, amount);
    }
}