const { expectRevert } = require("@openzeppelin/test-helpers");
const EDUMCoin = artifacts.require("EDUM");
const { toWei, assertBalance, assertOwnership, assertAllowance, waitForListed } = require("./common/test_common.js");

contract('EDUMCoin', function([d1, d2, m1, m2, a1, a2, a3]) {
  describe('Approval/transferFrom', function() {
    beforeEach(async function() {
      this.token = await EDUMCoin.new({ from: d1 });
      await this.token.transfer(m1, toWei('1000'), { from: d1 });
      await this.token.setControllers([m1, m2], {from: d1 });
    });

    it("minReleaseTime 체크. transferPreTimelock -> 상장 -> trnasferTimelock #1", async function() {
      let listedDate = 0;
      await this.token.transferPreTimelock(a1, [toWei('50'), toWei('100')], [15,10], { from: m1 });
      let tokenLockInfo = await this.token.getTokenlockStates(a1);
      assert.equal(tokenLockInfo.minReleaseTime, 0);

      await this.token.setListingDate(Math.round(Date.now()/1000),{from: d1});
      await this.token.getListingDate().then((_listedDate) => listedDate = parseInt(_listedDate.toString()));

      await this.token.transferTimelock(a1, [toWei('100')], [listedDate+20], { from: m1 });
      await assertBalance(this.token, a1, toWei('250'), toWei('250'));
      tokenLockInfo = await this.token.getTokenlockStates(a1);
      assert.equal(tokenLockInfo.minReleaseTime, listedDate+10)
    });

    it("minReleaseTime 체크. transferPreTimelock -> 상장 -> trnasferTimelock #2", async function() {
      let listedDate = 0;
      await this.token.transferPreTimelock(a1, [toWei('50'), toWei('100')], [15,10], { from: m1 });
      let tokenLockInfo = await this.token.getTokenlockStates(a1);
      assert.equal(tokenLockInfo.minReleaseTime, 0);

      await this.token.setListingDate(Math.round(Date.now()/1000),{from: d1});
      await this.token.getListingDate().then((_listedDate) => listedDate = parseInt(_listedDate.toString()));

      await this.token.transferTimelock(a1, [toWei('100')], [listedDate+5], { from: m1 });
      await assertBalance(this.token, a1, toWei('250'), toWei('250'));
      tokenLockInfo = await this.token.getTokenlockStates(a1);
      assert.equal(tokenLockInfo.minReleaseTime, listedDate+5)
    });
  });
});