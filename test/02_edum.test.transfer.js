const { expectRevert } = require("@openzeppelin/test-helpers");
const EDUMCoin = artifacts.require("EDUM");
const { toWei, assertBalance, assertOwnership, assertAllowance, waitForListed } = require("./common/test_common.js");

contract('EDUMCoin', function([d1, d2, m1, m2, a1, a2, a3]) {
  describe('transfer 테스트', function() {
    beforeEach(async function() {
      this.token = await EDUMCoin.new({ from: d1 });
    });

    it('transfer 함수 호출', async function() {
      await this.token.transfer(m1, toWei('1000000000'), { from: d1 });
      await assertBalance(this.token, d1, toWei('1000000000'), toWei('0'));
      await assertBalance(this.token, m1, toWei('1000000000'), toWei('0'));
    });
  });
});