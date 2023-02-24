const { expectRevert } = require("@openzeppelin/test-helpers");
const EDUMCoin = artifacts.require("EDUM");
const { toWei, assertBalance, assertOwnership, assertAllowance, waitForListed } = require("./common/test_common.js");

contract('EDUMCoin', function([d1, d2, m1, m2, a1, a2, a3]) {
  describe('상장 전 -> transferPreTimeLock 호출 -> 상장 -> Release', function() {
    beforeEach(async function() {
      this.token = await EDUMCoin.new({ from: d1 });
      await this.token.setControllers([m1, m2], {from: d1 });
      await this.token.transfer(m1, toWei('1000'), { from: d1 });
    });

    it('transferPreTimelock 호출 후 상장시키지 않을 경우 3초 후 Release 되지 않음', async function() {
      await this.token.transferPreTimelock(a1, [toWei('100')], [10], { from: m1 });
      await waitForListed(d1, this.token, 10);
      await assertBalance(this.token, a1, toWei('100'), toWei('100'));
    });

    it('transferPreTimelock 호출 후 상장시킬 경우 3초 후 Release 됨', async function() {
      await this.token.transferPreTimelock(a1, [toWei('100')], [10], { from: m1 });
      await this.token.setListingDate(Math.round(Date.now()/1000),{from: d1});
      await waitForListed(d1, this.token, 10);
      await assertBalance(this.token, a1, toWei('100'), toWei('0'));
    });

    it('상중 후에는 transferPreTimelock 호출 불가', async function() {
      await this.token.setListingDate(Math.round(Date.now()/1000),{from: d1});
      await expectRevert.unspecified(
        this.token.transferPreTimelock(a1, [toWei('100')], [10], { from: m1 })
      );
    });
  })
});