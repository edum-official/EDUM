const { expectRevert } = require("@openzeppelin/test-helpers");
const EDUMCoin = artifacts.require("EDUM");
const { toWei, assertBalance, assertOwnership, assertAllowance, waitForListed } = require("./common/test_common.js");

contract('EDUMCoin', function([d1, d2, m1, m2, a1, a2, a3]) {
  describe('Approval', function() {
    beforeEach(async function() {
      this.token = await EDUMCoin.new({ from: d1 });
      await this.token.transfer(m1, toWei('1000'), { from: d1 });
      await this.token.setControllers([m1, m2], {from: d1 });
    });

    it("Approval", async function() {
      await this.token.transfer(a1, toWei('100'), { from: m1 });
      await this.token.approve(a2, toWei('50'), { from: a1 });
      await assertAllowance(this.token, a1, a2, toWei('50'));
    });
  });
});