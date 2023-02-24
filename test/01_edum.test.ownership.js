const { expectRevert } = require("@openzeppelin/test-helpers");
const EDUMCoin = artifacts.require("EDUM");
const { assertBalance, assertAllowance, assertOwnership, waitForListed } = require("./common/test_common.js");

contract('EDUMCoin', function([d1, d2, m1, m2, a1, a2, a3]) {
  describe('TransferOwnership & setControllers', function() {
    before(async function() {
      this.token = await EDUMCoin.new({ from: d1 });
    });

    it('Owner(d1) 은 setController 호출 가능', async function() {
      await this.token.setControllers([m1, m2], {from: d1 });
      controllers = await this.token.getControllers();
      assert.equal(controllers.length, 2);
      assert.equal(controllers[0], m1);
      assert.equal(controllers[1], m2);
    });

    it('d2 은 setController 호출 불가능', async function() {
      await expectRevert.unspecified(
        this.token.setControllers([m1, m2], {from: d2 })
      );
    });

    it('transferOwnership: Owner d1 -> d2', async function() {
      await this.token.transferOwnership(d2, {from: d1 });
      await assertOwnership(this.token, d2);
    });

    it('d1 은 transferOwnership 호출 오류', async function() {
      await expectRevert.unspecified(
        this.token.transferOwnership(d2, {from: d1 })
      );
    });

    it('Owner(d2) 은 setController 호출 가능', async function() {
      await this.token.setControllers([m2, m1], {from: d2 });
      controllers = await this.token.getControllers();
      assert.equal(controllers.length, 2);
      assert.equal(controllers[0], m2);
      assert.equal(controllers[1], m1);
    });

    it('d1 은 setController 호출 불가능', async function() {
      await expectRevert.unspecified(
        this.token.setControllers([m1, m2], {from: d1 })
      );
    });
  });
});