const { expectRevert } = require("@openzeppelin/test-helpers");
const EDUMCoin = artifacts.require("EDUM");
const { toWei, assertBalance, assertOwnership, assertAllowance, waitForListed } = require("./common/test_common.js");

contract('EDUMCoin', function([d1, d2, m1, m2, a1, a2, a3]) {
  describe('setListingDate 테스트', function() {
    beforeEach(async function() {
      this.token = await EDUMCoin.new({ from: d1 });
    });

    it('Controller 호출 불가', async function() {
      await this.token.setControllers([m1, m2], {from: d1 });
      await expectRevert.unspecified(
        this.token.setListingDate(Math.round(Date.now()/1000), { from: m1 })
      );
    });

    it('일반 주소 호출 불가', async function() {
      await this.token.transfer(a1, toWei('1000'), { from: d1 });
      await expectRevert.unspecified(
        this.token.setListingDate(Math.round(Date.now()/1000), { from: a1 })
      );
    });

    it('Owner 인 경우 호출 가능', async function() {
      await this.token.setListingDate(Math.round(Date.now()/1000), { from: d1 });
    });

    it('setListingDate 두번 호출 불가', async function() {
      await this.token.setListingDate(Math.round(Date.now()/1000), { from: d1 });
      await expectRevert.unspecified(
        this.token.setListingDate(Math.round(Date.now()/1000),{ from: d1 })
      );
    });
  });
});