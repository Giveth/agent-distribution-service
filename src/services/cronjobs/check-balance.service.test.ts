import { expect } from 'chai';
import { CheckBalanceService } from './check-balance.service';
import { DiscordService } from '../discord.service';
import * as sinon from 'sinon';
import * as cron from 'node-cron';

describe('CheckBalanceService', () => {
  let checkBalanceService: CheckBalanceService;
  let discordServiceStub: sinon.SinonStubbedInstance<DiscordService>;

  beforeEach(() => {
    // Create stubs for dependencies
    discordServiceStub = sinon.createStubInstance(DiscordService);

    // Mock the constructor dependencies
    sinon.stub(CheckBalanceService.prototype, 'initialize').resolves();
    
    checkBalanceService = new CheckBalanceService();
    
    // Replace the actual service with stub
    (checkBalanceService as any).discordService = discordServiceStub;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('setupBalanceCheckJob', () => {
    it('should setup balance check job with valid cron schedule from config', () => {
      const cronScheduleStub = sinon.stub(cron, 'schedule').returns({
        start: sinon.stub(),
        stop: sinon.stub(),
        getStatus: () => 'scheduled'
      } as any);
      
      const validateStub = sinon.stub(cron, 'validate').returns(true);

      (checkBalanceService as any).setupBalanceCheckJob();

      expect(cronScheduleStub.calledWith(
        '0 * * * *', // Default from config
        sinon.match.func,
        {
          timezone: 'UTC'
        }
      )).to.be.true;
    });

    it('should use default cron schedule when config schedule is invalid', () => {
      const cronScheduleStub = sinon.stub(cron, 'schedule').returns({
        start: sinon.stub(),
        stop: sinon.stub(),
        getStatus: () => 'scheduled'
      } as any);
      
      const validateStub = sinon.stub(cron, 'validate').returns(false);

      (checkBalanceService as any).setupBalanceCheckJob();

      expect(cronScheduleStub.calledWith(
        '0 * * * *', // Default fallback
        sinon.match.func,
        {
          timezone: 'UTC'
        }
      )).to.be.true;
    });
  });
}); 