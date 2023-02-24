const web3 = require('web3');

const sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const assertBalance = async (_contract, _tokenHolder, _amount, _lockedAmount) => {
  balance     = await _contract.balanceOf(_tokenHolder);
  lockedBalance = await _contract.getLockedBalance(_tokenHolder);
  assert.equal(balance,       _amount);
  assert.equal(lockedBalance, _lockedAmount);
};

const assertLockedCount = async (_contract, _tokenHolder, _lockedCount) => {
  count = await _contract.getLockedCount(_tokenHolder);
  assert.equal(count, _lockedCount);
}

const assertLockBalance = async (_contract, _tokenHolder, _amount) => {
  balance = await _contract.getLockedBalance(_tokenHolder);
  assert.equal(balance, _amount);
};

const assertAllowance = async (_contract, _tokenHolder, _spender, _amount) => {
  balance = await _contract.allowance(_tokenHolder, _spender);
  assert.equal(balance, _amount);
};

const assertOwnership = async (_contract, _owner) => {
  owner = await _contract.owner();
  assert.equal(owner, _owner);
};

const waitForListed = async (_d1, _contract, _s) => {
    let listedDate = 0;
    await _contract.getListingDate().then((_listedDate) => listedDate = parseInt(_listedDate.toString()));
    if (listedDate == 0) return;
    console.log('\tWaiting %d secs from %d', _s, listedDate);
    while (true) {
        let timestamp = Math.round(Date.now()/1000);
        if (timestamp > (listedDate+_s)) break;
        await sleep(1000);
    }
    // await _contract.dummy({ from: _d1 });
}

function toWei(eth) {
  return web3.utils.toWei(eth, 'ether');
}

module.exports = {
  sleep,
  assertBalance,
  assertAllowance,
  assertOwnership,
  waitForListed,
  toWei
};