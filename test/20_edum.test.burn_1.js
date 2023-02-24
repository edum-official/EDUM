const { expectRevert } = require("@openzeppelin/test-helpers");
const EDUMCoin = artifacts.require("EDUM");
const { toWei, assertBalance, assertOwnership, assertAllowance, waitForListed } = require("./common/test_common.js");

contract('EDUMCoin', function([d1, d2, m1, m2, a1, a2, a3]) {
  describe('burn', function() {
    beforeEach(async function() {
      this.token = await EDUMCoin.new({ from: d1 });
      await this.token.transfer(m1, toWei('1000'), { from: d1 });
      await this.token.setControllers([m1, m2], {from: d1 });
    });

    it('토큰 소각', async function() {
      await this.token.burn(toWei('500'), { from: m1 })
      await expectRevert.unspecified(
        this.token.burn(toWei('1000'), { from: m1 })
      );
      await this.token.burn(toWei('500'), { from: m1 })
    });

    it('Lock 걸리 토큰 소각 불가', async function() {
      await this.token.transferPreTimelock(a1, [toWei('1000')], [10], { from: m1 });
      await expectRevert.unspecified(
        this.token.burn(toWei('500'), { from: a1 })
      );
    });
  })
});