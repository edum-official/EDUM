const { expectRevert } = require("@openzeppelin/test-helpers");
const EDUMCoin = artifacts.require("EDUM");
const { toWei, assertBalance, assertOwnership, assertAllowance, waitForListed } = require("./common/test_common.js");

contract('EDUMCoin', function([d1, d2, m1, m2, a1, a2, a3]) {
  describe('상장 -> transferTimelock 호출 -> Release', function() {
    let listedDate;
    beforeEach(async function() {
      this.token = await EDUMCoin.new({ from: d1 });
      await this.token.transfer(m1, toWei('1000'), { from: d1 });
      await this.token.setControllers([m1, m2], {from: d1 });
    });

    it('transferTimelock', async function() {
      await this.token.setListingDate(Math.round(Date.now()/1000),{from: d1});
      await this.token.getListingDate().then((_listedDate) => listedDate = parseInt(_listedDate.toString()));
      await this.token.transferTimelock(a1, [toWei('100')], [listedDate+10], { from: m1 });
      await assertBalance(this.token, a1, toWei('100'), toWei('100'));
    });

    it('상장 후에는 transferPreTimelock 호출 불가', async function() {
      await this.token.setListingDate(Math.round(Date.now()/1000),{from: d1});
      await this.token.getListingDate().then((_listedDate) => listedDate = parseInt(_listedDate.toString()));
      await expectRevert.unspecified(
        this.token.transferPreTimelock(a1, [toWei('100')], [listedDate+10], { from: m1 })
      );
    });
  });
});