const { expectRevert } = require("@openzeppelin/test-helpers");
const { inTransaction } = require("@openzeppelin/test-helpers/src/expectEvent");
const EDUMCoin = artifacts.require("EDUM");
const web3 = require('web3');

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const assertBalance = async (_contract, _tokenHolder, _amount, _lockedAmount) => {
  let balance     = await _contract.balanceOf(_tokenHolder);
  let lockedBalance = await _contract.getLockedBalance(_tokenHolder);
  console.log('BALANCE:'+balance.toString())
  console.log('LOCKED :'+lockedBalance.toString())
  assert.equal(balance,       _amount);
  assert.equal(lockedBalance, _lockedAmount);
};

const assertLockedCount = async (_contract, _tokenHolder, _lockedCount) => {
  let count = await _contract.getLockedCount(_tokenHolder);
  assert.equal(count, _lockedCount);
}

const assertLockBalance = async (_contract, _tokenHolder, _amount) => {
  let balance = await _contract.getLockedBalance(_tokenHolder);
  assert.equal(balance, _amount);
};

const assertAllowance = async (_contract, _tokenHolder, _spender, _amount) => {
  let balance = await _contract.allowance(_tokenHolder, _spender);
  assert.equal(balance, _amount);
};

const waitForListed = async (_d1, _contract, _s) => {
    let listedDate = 0;
    await _contract.getListingDate().then((_listedDate) => listedDate = parseInt(_listedDate.toString()));
    if (listedDate == 0) return;
    console.log('\tWait until %d (listedDate = %d)', listedDate+_s, listedDate);
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

contract('EDUMCoin', function([d1, d2, m1, m2, a1, a2, a3]) {
  describe('transferPreTimelock -> 상장 -> transferTimelock -> Release', function() {
    let listedDate = 0;
    before(async function() {
      this.token = await EDUMCoin.new({ from: d1 });
      await this.token.setControllers([m1, m2], {from: d1 });
      await this.token.transfer(m1, toWei('1001'), { from: d1 });
    });

    it('transferPreTimelock. LockInfo (3초,100) (6초,200)', async function() {
        await this.token.transferPreTimelock(a1, [toWei('100'), toWei('200')], [3, 10], { from: m1 });
        await assertBalance(this.token, a1, toWei('300'), toWei('300'));

        await this.token.transferPreTimelock(a2, [toWei('200'), toWei('100')], [7, 15], { from: m1 });
        await assertBalance(this.token, a2, toWei('300'), toWei('300'));
    });

    it('setListingDate', async function() {
        await this.token.setListingDate(Math.round(Date.now()/1000),{from: d1});
        await this.token.getListingDate().then((_listedDate) => listedDate = parseInt(_listedDate.toString()));
        console.log('\tListedDate: %s', listedDate);
    });

    it('3초 후 100 토큰 Release', async function() {
        await waitForListed(d1, this.token, 3);
        await assertBalance(this.token, a1, toWei('300'), toWei('200'));
    });

    it('일부 토큰이 락이 걸려 있어 200 토큰 전송 불가', async function() {
        await expectRevert.unspecified(
            this.token.transfer(a2, toWei('200'), { from: a1 })
        );
    });

    it('Release 토큰은 전송 가능', async function() {
        await this.token.transfer(a2, toWei('100'), { from: a1 })
        await assertBalance(this.token, a1, toWei('200'), toWei('200'));
        await assertBalance(this.token, a2, toWei('400'), toWei('300'));

        let tokenLockInfo = await this.token.getTokenlockStates(a1);
        assert.equal(tokenLockInfo.minReleaseTime, listedDate + 10);
    });

    it('상장 후 transferTimelock', async function() {
        await this.token.transferTimelock(a1, [toWei('100'), toWei('200')], [listedDate+8, listedDate+13], { from: m1 });
        await assertBalance(this.token, a1, toWei('500'), toWei('500'));

        let tokenLockInfo = await this.token.getTokenlockStates(a1);
        assert.equal(tokenLockInfo.minReleaseTime, listedDate+8);
        assert.equal(tokenLockInfo.lockInfo.length, 3);
        assert.equal(tokenLockInfo.lockInfo[0].amount, toWei('200'));
        assert.equal(tokenLockInfo.lockInfo[0].releaseTime, listedDate+10);
        assert.equal(tokenLockInfo.lockInfo[1].amount, toWei('100'));
        assert.equal(tokenLockInfo.lockInfo[1].releaseTime, listedDate+8);
        assert.equal(tokenLockInfo.lockInfo[2].amount, toWei('200'));
        assert.equal(tokenLockInfo.lockInfo[2].releaseTime, listedDate+13);
    });
  });
});