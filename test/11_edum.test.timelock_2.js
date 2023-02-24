const { expectRevert } = require("@openzeppelin/test-helpers");
const EDUMCoin = artifacts.require("EDUM");
const { toWei, assertBalance, assertOwnership, assertAllowance, waitForListed } = require("./common/test_common.js");

contract('EDUMCoin', function([d1, d2, m1, m2, a1, a2, a3]) {
  describe('상장 전 transferPreTimelock', function() {
    beforeEach(async function() {
      this.token = await EDUMCoin.new({ from: d1 });
      await this.token.setControllers([m1, m2], {from: d1 });
      await this.token.transfer(m1, toWei('1000'), { from: d1 });
      await this.token.transfer(a2, toWei('1000'), { from: d1 });
    });

    it('Owner 는 transferPreTimelock 호출 불가', async function() {
      await expectRevert.unspecified(
        this.token.transferPreTimelock(a1, [toWei('100')], [5], { from: d1 })
      );
    });

    it('일반 주소는 transferPreTimelock 호출 불가', async function() {
      await expectRevert.unspecified(
        this.token.transferPreTimelock(a1, [toWei('100')], [5], { from: a2 })
      );
    });

    it('Controller 는 transferPreTimelock 호출 가능', async function() {
        await this.token.transferPreTimelock(a1, [toWei('100'), toWei('200')], [15, 20], { from: m1 });
        await assertBalance(this.token, a1, toWei('300'), toWei('300'));
        let tokenLockInfo = await this.token.getTokenlockStates(a1);
        assert.equal(tokenLockInfo.minReleaseTime, 0);
        assert.equal(tokenLockInfo.lockInfo.length, 2);
        assert.equal(tokenLockInfo.lockInfo[0].amount, toWei('100'));
        assert.equal(tokenLockInfo.lockInfo[0].releaseTime, 15);
        assert.equal(tokenLockInfo.lockInfo[1].amount, toWei('200'));
        assert.equal(tokenLockInfo.lockInfo[1].releaseTime, 20);
    });

    it('상장 전에는 transferTimelock 호출 불가', async function() {
      let timestamp = Math.round(Date.now()/1000);
      await expectRevert.unspecified(
        this.token.transferTimelock(a1, [toWei('100')], [timestamp+10], { from: m1 })
      );
    });
  });
});