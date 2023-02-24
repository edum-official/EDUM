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

    it("Approval/TransferFrom 테스트", async function() {
      await this.token.transfer(a1, toWei('100'), { from: m1 });
      await this.token.approve(a2, toWei('100'), { from: a1 });
      await assertAllowance(this.token, a1, a2, toWei('100'));
      await expectRevert.unspecified(
        this.token.transferFrom(a1, a3, toWei('200'), { from: a2 })
      );
      await this.token.transferFrom(a1, a3, toWei('100'), { from: a2 })
      await assertBalance(this.token, m1, toWei('900'), toWei('0'));
      await assertBalance(this.token, a1, toWei('0'), toWei('0'));
      await assertBalance(this.token, a3, toWei('100'), toWei('0'));
    });

    it("transferPreTimelock Approval/TransferFrom", async function() {
      await this.token.transferPreTimelock(a1, [toWei('100')], [3], { from: m1 });
      await this.token.approve(a2, toWei('100'), { from: a1 });
      await expectRevert.unspecified(
        this.token.transferFrom(a1, a3, toWei('50'), { from: a2 })
      );

      // 상장 후 3초 대기
      await this.token.setListingDate(Math.round(Date.now()/1000),{from: d1});
      await waitForListed(d1, this.token, 3)
      await this.token.transferFrom(a1, a3, toWei('50'), { from: a2 })
      await assertBalance(this.token, a1, toWei('50'), toWei('0'));
      await assertBalance(this.token, a3, toWei('50'), toWei('0'));
    });

    it("transferTimelock Approval/TransferFrom", async function() {
      let listedDate = 0;
      await this.token.setListingDate(Math.round(Date.now()/1000),{from: d1});
      await this.token.getListingDate().then((_listedDate) => listedDate = parseInt(_listedDate.toString()));

      await this.token.transferTimelock(a1, [toWei('100')], [listedDate+5], { from: m1 });
      await this.token.approve(a2, toWei('100'), { from: a1 });
      await expectRevert.unspecified(
        this.token.transferFrom(a1, a3, toWei('50'), { from: a2 })
      );

      // 상장 후 3초 대기
      await waitForListed(d1, this.token, 5)
      await this.token.transferFrom(a1, a3, toWei('50'), { from: a2 })
      await assertBalance(this.token, a1, toWei('50'), toWei('0'));
      await assertBalance(this.token, a3, toWei('50'), toWei('0'));
    });
  });
});