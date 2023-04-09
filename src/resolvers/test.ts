import { Test } from '../entities/test';
import { Arg, Ctx, Mutation, Query, Resolver } from 'type-graphql';
import { Context } from '../types';
import { LeaderBoard, UserStats } from '../utils/objectTypes';

@Resolver()
export class TestResolver {
  @Query(() => [Test])
  async tests(@Ctx() ctx: Context, @Arg('uid') uid: string): Promise<Test[]> {
    const qb = ctx.em
      .createQueryBuilder(Test, 'test')
      .where('test.creatorId = :id', { id: uid })
      .orderBy('"createdAt"', 'DESC')
      .take(15);

    const tests = await qb.getMany();
    return tests;
  }

  @Mutation(() => Test)
  async createTest(
    @Ctx() ctx: Context,
    @Arg('uid') uid: string,
    @Arg('time') time: string,
    @Arg('accuracy') accuracy: string,
    @Arg('wpm') wpm: number,
    @Arg('chars') chars: string,
    @Arg('testTaken') testTaken: string
  ): Promise<Test> {
    return await ctx.em
      .create(Test, {
        creatorId: uid,
        time: time,
        accuracy: accuracy,
        wpm: wpm,
        chars: chars,
        testTaken: testTaken,
      })
      .save();
  }

  @Query(() => UserStats)
  async getStats(
    @Ctx() ctx: Context,
    @Arg('uid') uid: string
  ): Promise<UserStats> {
    const times = ['15', '30', '45', '60', '120'];
    let userStats = [];

    for (let i = 0; i < times.length; i++) {
      const qb = ctx.em
        .createQueryBuilder(Test, 'test')
        .where('test.creatorId = :id', { id: uid })
        .andWhere('test.time = :time', { time: times[i] })
        .orderBy('test.createdAt', 'DESC');

      const tests = await qb.getMany();
      let wpm = 0;
      let accuracy = 0;
      let wpmList: number[] = [];
      const length = tests.length;

      tests.forEach((test) => {
        wpm = wpm + test.wpm;
        accuracy = accuracy + parseInt(test.accuracy.replace('%', ''));
        wpmList.push(test.wpm);
      });

      const finalWpm = Math.round(wpm / length);
      const finalAccuracy = Math.round(accuracy / length);
      const pb = wpmList.length > 0 ? Math.max(...wpmList) : 0;

      userStats.push({
        time: times[i],
        wpm: finalWpm ? finalWpm : 0,
        pb: pb,
        accuracy: !Number.isNaN(finalAccuracy) ? `${finalAccuracy}%` : '0%',
        testsTaken: length,
      });
    }

    return {
      userStats,
    };
  }

  @Query(() => LeaderBoard)
  async leaderboard(
    @Ctx() ctx: Context,
    @Arg('time') time: string
  ): Promise<LeaderBoard> {
    const qb = ctx.em
      .createQueryBuilder(Test, 'test')
      .innerJoin(
        (subQuery) =>
          subQuery
            .select('MAX(t.wpm)', 'max_wpm')
            .addSelect('t.creatorId', 'creatorId')
            .from(Test, 't')
            .where('t.time = :time', { time: time })
            .groupBy('t.creatorId'),
        'max_tests',
        'max_tests.max_wpm = test.wpm AND max_tests."creatorId" = test."creatorId"'
      )
      .leftJoinAndSelect('test.creator', 'creator')
      .where('test.time = :time', { time: time })
      .orderBy('test.wpm', 'DESC')
      .limit(50);

    const tests = await qb.getMany();
    let leaderBoard = [];
    const length = tests.length;
    for (let i = 0; i < length; i++) {
      leaderBoard.push({
        rank: i + 1,
        user: tests[i].creator.username,
        wpm: tests[i].wpm,
        accuracy: tests[i].accuracy,
        time: time,
        testTaken: tests[i].testTaken,
      });
    }
    return {
      leaderBoard,
    };
  }
}
