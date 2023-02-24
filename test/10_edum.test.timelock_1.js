const { expectRevert } = require("@openzeppelin/test-helpers");
const EDUMCoin = artifacts.require("EDUM");
const { toWei, assertBalance, assertOwnership, assertAllowance, waitForListed } = require("./common/test_common.js");

contract('EDUMCoin', function([d1, d2, m1, m2, a1, a2, a3]) {
  describe('transferPreTimelock, transferTimelock controller 만 호출 가능', function() {
    let timestamp;
    beforeEach(async function() {
      timestamp = Math.round(Date.now()/1000);
      this.token = await EDUMCoin.new({ from: d1 });
      await this.token.transfer(m1, toWei('1000'), { from: d1 });
      await this.token.transfer(a1, toWei('1000'), { from: d1 });
    });

    it('Owner transferPreTimelock 호출 불가', async function() {
      await expectRevert.unspecified(
        this.token.transferPreTimelock(a1, [toWei('100')], [timestamp+5], { from: d1 })
      );
    });

    it('Owner transferTimelock 호출 불가', async function() {
      await this.token.setListingDate(Math.round(Date.now()/1000),{from: d1});
      await expectRevert.unspecified(
        this.token.transferTimelock(a1, [toWei('100')], [timestamp+5], { from: d1 })
      );
    });

    it('일반주소는 transferPreTimelock 호출 불가', async function() {
      await expectRevert.unspecified(
        this.token.transferPreTimelock(a1, [toWei('100')], [5], { from: m1 })
      );
    });

    it('일반주소는 transferTimelock 호출 불가', async function() {
      await this.token.setListingDate(Math.round(Date.now()/1000),{from: d1});
      await expectRevert.unspecified(
        this.token.transferTimelock(a1, [toWei('100')], [5], { from: m1 })
      );
    });
  })
});