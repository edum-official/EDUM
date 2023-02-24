const { expectRevert } = require("@openzeppelin/test-helpers");
const { inTransaction } = require("@openzeppelin/test-helpers/src/expectEvent");
const EDUMCoin = artifacts.require("EDUM");
const web3 = require('web3');

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const assertBalance = async (_contract, _tokenHolder, _amount, _lockedAmount) => {
  balance     = await _contract.balanceOf(_tokenHolder);
  lockedBalance = await _contract.getLockedBalance(_tokenHolder);
  assert.equal(balance,       _amount);
  assert.equal(lockedBalance, _lockedAmount);
};

const assertLockedCount = async (_contract, _tokenHolder, _lockedCount) => {
  count = await _contract.getLockedCount(_tokenHolder);
  assert.equal(count, _lockedCount);
}

const assertLockBalance = async (_contract, _tokenHolder, _amount) => {
  balance = await _contract.getLockedBalance(_tokenHolder);
  assert.equal(balance, _amount);
};

const assertAllowance = async (_contract, _tokenHolder, _spender, _amount) => {
  balance = await _contract.allowance(_tokenHolder, _spender);
  assert.equal(balance, _amount);
};

const assertOwnership = async (_contract, _owner) => {
  owner = await _contract.owner();
  assert.equal(owner, _owner);
};

const waitForListed = async (_d1, _contract, _s) => {
    let listedDate = 0;
    await _contract.getListingDate().then((_listedDate) => listedDate = parseInt(_listedDate.toString()));
    if (listedDate == 0) return;
    console.log('\tWaiting %d secs from %d', _s, listedDate);
    while (true) {
        let timestamp = Math.round(Date.now()/1000);
        if (timestamp > (listedDate+_s)) break;
        await sleep(1000);
    }
    // await _contract.dummy({ from: _d1 });
}

function toWei(eth) {
  return web3.utils.toWei(eth, 'ether');
}

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

  describe('multiTransfer 테스트', function() {
    beforeEach(async function() {
      this.token = await EDUMCoin.new({ from: d1 });
    });

    it('multiTransfer 함수 호출', async function() {
      await this.token.multiTransfer([m1,m2], [toWei('1000000000'), toWei('1000000000')], { from: d1 });
      await assertBalance(this.token, d1, toWei('0'), toWei('0'));
      await assertBalance(this.token, m1, toWei('1000000000'), toWei('0'));
      await assertBalance(this.token, m2, toWei('1000000000'), toWei('0'));
    });
  });

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
        this.token.transferPreTimelock(a1, [toWei('100')], [timestamp+10], { from: d1 })
      );
    });

    it('Owner transferTimelock 호출 불가', async function() {
      await this.token.setListingDate(Math.round(Date.now()/1000),{from: d1});
      await expectRevert.unspecified(
        this.token.transferTimelock(a1, [toWei('100')], [timestamp+10], { from: d1 })
      );
    });

    it('일반주소는 transferPreTimelock 호출 불가', async function() {
      await expectRevert.unspecified(
        this.token.transferPreTimelock(a1, [toWei('100')], [10], { from: m1 })
      );
    });

    it('일반주소는 transferTimelock 호출 불가', async function() {
      await this.token.setListingDate(Math.round(Date.now()/1000),{from: d1});
      await expectRevert.unspecified(
        this.token.transferTimelock(a1, [toWei('100')], [10], { from: m1 })
      );
    });
  })

  describe('상장 전 transferPreTimelock', function() {
    beforeEach(async function() {
      this.token = await EDUMCoin.new({ from: d1 });
      await this.token.setControllers([m1, m2], {from: d1 });
      await this.token.transfer(m1, toWei('1000'), { from: d1 });
      await this.token.transfer(a2, toWei('1000'), { from: d1 });
    });

    it('Owner 는 transferPreTimelock 호출 불가', async function() {
      await expectRevert.unspecified(
        this.token.transferPreTimelock(a1, [toWei('100')], [10], { from: d1 })
      );
    });

    it('일반 주소는 transferPreTimelock 호출 불가', async function() {
      await expectRevert.unspecified(
        this.token.transferPreTimelock(a1, [toWei('100')], [10], { from: a2 })
      );
    });

    it('Controller 는 transferPreTimelock 호출 가능', async function() {
        await this.token.transferPreTimelock(a1, [toWei('100'), toWei('200')], [10, 20], { from: m1 });
        await assertBalance(this.token, a1, toWei('300'), toWei('300'));
        let tokenLockInfo = await this.token.getTokenlockStates(a1);
        assert.equal(tokenLockInfo.minReleaseTime, 0);
        assert.equal(tokenLockInfo.lockInfo.length, 2);
        assert.equal(tokenLockInfo.lockInfo[0].amount, toWei('100'));
        assert.equal(tokenLockInfo.lockInfo[0].releaseTime, 10);
        assert.equal(tokenLockInfo.lockInfo[1].amount, toWei('200'));
        assert.equal(tokenLockInfo.lockInfo[1].releaseTime, 20);
    });

    it('상장 전에는 transferTimelock 호출 불가', async function() {
      let timestamp = Math.round(Date.now()/1000);
      await expectRevert.unspecified(
        this.token.transferTimelock(a1, [toWei('100')], [timestamp+10], { from: m1 })
      );
    });
  });

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

  describe('transferPreTimelock -> 상장 -> transferTimelock -> Release', function() {
    let listedDate = 0;
    before(async function() {
      this.token = await EDUMCoin.new({ from: d1 });
      await this.token.setControllers([m1, m2], {from: d1 });
      await this.token.transfer(m1, toWei('1001'), { from: d1 });
    });

    it('transferPreTimelock. LockInfo (3초,100) (6초,200)', async function() {
        await this.token.transferPreTimelock(a1, [toWei('100'), toWei('200')], [10, 20], { from: m1 });
        await assertBalance(this.token, a1, toWei('300'), toWei('300'));

        await this.token.transferPreTimelock(a2, [toWei('200'), toWei('100')], [15, 25], { from: m1 });
        await assertBalance(this.token, a2, toWei('300'), toWei('300'));
    });

    it('setListingDate', async function() {
        await this.token.setListingDate(Math.round(Date.now()/1000),{from: d1});
        await this.token.getListingDate().then((_listedDate) => listedDate = parseInt(_listedDate.toString()));
        console.log('\tListedDate: %s', listedDate);
    });

    it('3초 후 100 토큰 Release', async function() {
        await waitForListed(d1, this.token, 10);
        await assertBalance(this.token, a1, toWei('300'), toWei('200'));
    });

    it('일부 토큰이 락이 걸려 있어 200 토큰 전송 불가', async function() {
        await expectRevert.unspecified(
            this.token.transfer(a2, toWei('200'), { from: a1 })
        );
    });

    it('Release 토큰은 전송 가능', async function() {
        await this.token.transfer(a2, toWei('100'), { from: a1 })
        await assertBalance(this.token, a1, toWei('200'), toWei('200'));
        await assertBalance(this.token, a2, toWei('400'), toWei('300'));
    });

    it('상장 후 transferTimelock', async function() {
        await this.token.transferTimelock(a1, [toWei('100'), toWei('200')], [listedDate+10, listedDate+30], { from: m1 });
        await assertBalance(this.token, a1, toWei('500'), toWei('500'));

        let tokenLockInfo = await this.token.getTokenlockStates(a1);
        assert.equal(tokenLockInfo.minReleaseTime, listedDate+10);
        assert.equal(tokenLockInfo.lockInfo.length, 3);
        assert.equal(tokenLockInfo.lockInfo[0].amount, toWei('200'));
        assert.equal(tokenLockInfo.lockInfo[0].releaseTime, listedDate+10);
        assert.equal(tokenLockInfo.lockInfo[1].amount, toWei('100'));
        assert.equal(tokenLockInfo.lockInfo[1].releaseTime, listedDate+8);
        assert.equal(tokenLockInfo.lockInfo[2].amount, toWei('200'));
        assert.equal(tokenLockInfo.lockInfo[2].releaseTime, listedDate+13);
    });
  });

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
      await this.token.transferPreTimelock(a1, [toWei('100')], [10], { from: m1 });
      await expectRevert.unspecified(
        this.token.burn(toWei('100'), { from: a1 })
      );
      await this.token.setListingDate(Math.round(Date.now()/1000), {from: d1 });
      await waitForListed(d1, this.token, 10);
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
      await this.token.transferTimelock(a1, [toWei('100')], [listedDate+10], { from: m1 });
      await expectRevert.unspecified(
        this.token.burn(toWei('50'), { from: a1 })
      );
      await waitForListed(d1, this.token, 10);
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
      await this.token.transferPreTimelock(a1, [toWei('100')], [10], { from: m1 });
      await this.token.setListingDate(Math.round(Date.now()/1000), {from: d1 });
      await this.token.getListingDate().then((_listedDate) => listedDate = parseInt(_listedDate.toString()));
      await this.token.transferTimelock(a1, [toWei('100'), toWei('100')], [listedDate+15, listedDate+10], { from: m1 });
      await assertBalance(this.token, a1, toWei('300'), toWei('300'));

      // Release 되기 전에는 소각 불가
      await expectRevert.unspecified(
        this.token.burn(toWei('50'), { from: a1 })
      );

      // (listedDate+5)초 기다린 후에 Release 된 100개 중에 50개 소각
      await waitForListed(d1, this.token, 10);
      await assertBalance(this.token, a1, toWei('300'), toWei('200'));
      await this.token.burn(toWei('50'), { from: a1 })
      await assertBalance(this.token, a1, toWei('250'), toWei('200'));
      // 다시 100 개 소각. Release 된 토큰 모자라서 불가
      await expectRevert.unspecified(
        this.token.burn(toWei('100'), { from: a1 })
      );

      // (listedDate+10)초 기다린 후에 Release 된 150/300개 중에 100개 소각
      await waitForListed(d1, this.token, 20);
      await assertBalance(this.token, a1, toWei('250'), toWei('100'));
      await this.token.burn(toWei('100'), { from: a1 })
      await assertBalance(this.token, a1, toWei('150'), toWei('100'));

      // 다시 200 개 소각 불가
      await expectRevert.unspecified(
        this.token.burn(toWei('200'), { from: a1 })
      );

      // (listedDate+15)초 기다린 후에 Release 된 150개 중에 100개 소각
      await waitForListed(d1, this.token, 20);
      await assertBalance(this.token, a1, toWei('150'), toWei('0'));

      // 모두 소각
      await this.token.burn(toWei('150'), { from: a1 })
      await assertBalance(this.token, a1, toWei('0'), toWei('0'));
    });
  })

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

  describe('Approval/transferFrom', function() {
    beforeEach(async function() {
      this.token = await EDUMCoin.new({ from: d1 });
      await this.token.transfer(m1, toWei('1000'), { from: d1 });
      await this.token.setControllers([m1, m2], {from: d1 });
    });

    it("minReleaseTime 체크. transferPreTimelock -> 상장 -> trnasferTimelock #1", async function() {
      let listedDate = 0;
      await this.token.transferPreTimelock(a1, [toWei('50'), toWei('100')], [15,10], { from: m1 });
      let tokenLockInfo = await this.token.getTokenlockStates(a1);
      assert.equal(tokenLockInfo.minReleaseTime, 0);

      await this.token.setListingDate(Math.round(Date.now()/1000),{from: d1});
      await this.token.getListingDate().then((_listedDate) => listedDate = parseInt(_listedDate.toString()));

      await this.token.transferTimelock(a1, [toWei('100')], [listedDate+20], { from: m1 });
      await assertBalance(this.token, a1, toWei('250'), toWei('250'));
      tokenLockInfo = await this.token.getTokenlockStates(a1);
      assert.equal(tokenLockInfo.minReleaseTime, listedDate+10)
    });

    it("minReleaseTime 체크. transferPreTimelock -> 상장 -> trnasferTimelock #2", async function() {
      let listedDate = 0;
      await this.token.transferPreTimelock(a1, [toWei('50'), toWei('100')], [15,10], { from: m1 });
      let tokenLockInfo = await this.token.getTokenlockStates(a1);
      assert.equal(tokenLockInfo.minReleaseTime, 0);

      await this.token.setListingDate(Math.round(Date.now()/1000),{from: d1});
      await this.token.getListingDate().then((_listedDate) => listedDate = parseInt(_listedDate.toString()));

      await this.token.transferTimelock(a1, [toWei('100')], [listedDate+5], { from: m1 });
      await assertBalance(this.token, a1, toWei('250'), toWei('250'));
      tokenLockInfo = await this.token.getTokenlockStates(a1);
      assert.equal(tokenLockInfo.minReleaseTime, listedDate+5)
    });
  });
});