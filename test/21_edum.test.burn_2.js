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

    it('transferPreTimelock 걸리 토큰 Release 후 소각', async function() {
      await this.token.transferPreTimelock(a1, [toWei('100')], [5], { from: m1 });
      await expectRevert.unspecified(
        this.token.burn(toWei('100'), { from: a1 })
      );
      await this.token.setListingDate(Math.round(Date.now()/1000), {from: d1 });
      await waitForListed(d1, this.token, 5);
      await this.token.burn(toWei('50'), { from: a1 })
      await assertBalance(this.token, a1, toWei('50'), toWei('0'));
      await this.token.burn(toWei('50'), { from: a1 })
      await assertBalance(this.token, a1, toWei('0'), toWei('0'));
      await expectRevert.unspecified(
        this.token.burn(toWei('50'), { from: a1 })
      );
    });

    it('transferTimelock 걸리 토큰 Release 후 소각', async function() {
      let listedDate = 0;
      await this.token.setListingDate(Math.round(Date.now()/1000), {from: d1 });
      await this.token.getListingDate().then((_listedDate) => listedDate = parseInt(_listedDate.toString()));
      await this.token.transferTimelock(a1, [toWei('100')], [listedDate+5], { from: m1 });
      await expectRevert.unspecified(
        this.token.burn(toWei('50'), { from: a1 })
      );
      await waitForListed(d1, this.token, 5);
      await expectRevert.unspecified(
        this.token.burn(toWei('500'), { from: a1 })
      );
      await this.token.burn(toWei('50'), { from: a1 })
      await assertBalance(this.token, a1, toWei('50'), toWei('0'));
      await this.token.burn(toWei('50'), { from: a1 })
      await assertBalance(this.token, a1, toWei('0'), toWei('0'));
    });

    it('transferPreTimelock, transferTimelock 걸리 토큰 Release 후 소각', async function() {
      let listedDate = 0;
      await this.token.transferPreTimelock(a1, [toWei('100')], [5], { from: m1 });
      await this.token.setListingDate(Math.round(Date.now()/1000), {from: d1 });
      await this.token.getListingDate().then((_listedDate) => listedDate = parseInt(_listedDate.toString()));
      await this.token.transferTimelock(a1, [toWei('100'), toWei('100')], [listedDate+15, listedDate+10], { from: m1 });
      await assertBalance(this.token, a1, toWei('300'), toWei('300'));

      // Release 되기 전에는 소각 불가
      await expectRevert.unspecified(
        this.token.burn(toWei('50'), { from: a1 })
      );

      // (listedDate+5)초 기다린 후에 Release 된 100개 중에 50개 소각
      await waitForListed(d1, this.token, 5);
      await assertBalance(this.token, a1, toWei('300'), toWei('200'));
      await this.token.burn(toWei('50'), { from: a1 })
      await assertBalance(this.token, a1, toWei('250'), toWei('200'));
      // 다시 100 개 소각. Release 된 토큰 모자라서 불가
      await expectRevert.unspecified(
        this.token.burn(toWei('100'), { from: a1 })
      );

      // (listedDate+10)초 기다린 후에 Release 된 150/300개 중에 100개 소각
      await waitForListed(d1, this.token, 10);
      await assertBalance(this.token, a1, toWei('250'), toWei('100'));
      await this.token.burn(toWei('100'), { from: a1 })
      await assertBalance(this.token, a1, toWei('150'), toWei('100'));

      // 다시 200 개 소각 불가
      await expectRevert.unspecified(
        this.token.burn(toWei('200'), { from: a1 })
      );

      // (listedDate+15)초 기다린 후에 Release 된 150개 중에 100개 소각
      await waitForListed(d1, this.token, 15);
      await assertBalance(this.token, a1, toWei('150'), toWei('0'));

      // 모두 소각
      await this.token.burn(toWei('150'), { from: a1 })
      await assertBalance(this.token, a1, toWei('0'), toWei('0'));
    });
  })
});