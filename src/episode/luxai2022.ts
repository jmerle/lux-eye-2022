import {
  Board,
  Episode,
  Faction,
  Factory,
  FactoryAction,
  Robot,
  RobotAction,
  RobotType,
  SetupAction,
  Step,
  Team,
  Weather,
} from './model';

function parseSetupAction(data: any): SetupAction {
  if (data.bid !== undefined && data.faction !== undefined) {
    return {
      type: 'bid',
      bid: data.bid,
      faction: data.faction,
    };
  } else if (data.spawn !== undefined && data.water !== undefined && data.metal !== undefined) {
    return {
      type: 'buildFactory',
      center: {
        x: data.spawn[0],
        y: data.spawn[1],
      },
      water: data.water,
      metal: data.metal,
    };
  } else if (Object.keys(data).length === 0) {
    return {
      type: 'wait',
    };
  } else {
    throw new Error(`Cannot parse '${data}' as setup action`);
  }
}

function parseFactoryAction(data: any): FactoryAction {
  if (data === 0) {
    return {
      type: 'buildRobot',
      robotType: RobotType.Light,
    };
  } else if (data === 1) {
    return {
      type: 'buildRobot',
      robotType: RobotType.Heavy,
    };
  } else if (data === 2) {
    return {
      type: 'water',
    };
  } else {
    throw new Error(`Cannot parse '${data}' as factory action`);
  }
}

function parseRobotAction(data: any): RobotAction {
  switch (data[0]) {
    case 0:
      return {
        type: 'move',
        repeat: data[4],
        direction: data[1],
      };
    case 1:
      return {
        type: 'transfer',
        repeat: data[4],
        direction: data[1],
        resource: data[2],
        amount: data[3],
      };
    case 2:
      return {
        type: 'pickup',
        repeat: data[4],
        resource: data[2],
        amount: data[3],
      };
    case 3:
      return {
        type: 'dig',
        repeat: data[4],
      };
    case 4:
      return {
        type: 'selfDestruct',
        repeat: data[4],
      };
    case 5:
      return {
        type: 'recharge',
        repeat: data[4],
        targetPower: data[3],
      };
    default:
      throw new Error(`Cannot parse '${data}' as robot action`);
  }
}

export function isLuxAI2022Episode(data: any): boolean {
  return typeof data === 'object' && data.observations !== undefined && data.actions !== undefined;
}

export function parseLuxAI2022Episode(data: any, teamNames: [string, string] = ['Player A', 'Player B']): Episode {
  const steps: Step[] = [];
  const weatherSchedule = data.observations[0].weather_schedule;

  for (let i = 0; i < data.observations.length; i++) {
    const obs = data.observations[i];

    let actions: Record<string, any> = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      player_0: {},
      // eslint-disable-next-line @typescript-eslint/naming-convention
      player_1: {},
    };

    if (data.observations.length === data.actions.length) {
      if (i < data.actions.length - 1) {
        actions = data.actions[i + 1];
      }
    } else if (i < data.actions.length) {
      actions = data.actions[i];
    }

    let board: Board;
    if (i === 0) {
      board = {
        rubble: obs.board.rubble,
        ore: obs.board.ore,
        ice: obs.board.ice,
        lichen: obs.board.lichen,
        lichenStrains: obs.board.lichen_strains,
      };
    } else {
      board = JSON.parse(JSON.stringify(steps[i - 1].board));

      for (const [item, grid] of <[string, number[][]][]>[
        ['rubble', board.rubble],
        ['lichen', board.lichen],
        ['lichen_strains', board.lichenStrains],
      ]) {
        for (const key in obs.board[item]) {
          const [x, y] = key.split(',').map(part => parseInt(part));
          grid[y][x] = obs.board[item][key];
        }
      }
    }

    const teams: Team[] = [];
    for (let j = 0; j < 2; j++) {
      const playerId = `player_${j}`;

      if (obs.teams[playerId] === undefined) {
        teams.push({
          name: teamNames[j],
          faction:
            data.observations[1].teams[playerId] !== undefined
              ? data.observations[1].teams[playerId].faction
              : Faction.None,

          water: 0,
          metal: 0,

          factories: [],
          robots: [],

          factoriesToPlace: 0,
          spawns: data.observations[0].board.spawns[playerId].map((arr: any) => ({ x: arr[0], y: arr[1] })),

          action: actions[playerId] !== null ? parseSetupAction(actions[playerId]) : null,
        });

        continue;
      }

      const factories: Factory[] = [];
      for (const unitId of Object.keys(obs.factories[playerId])) {
        const rawFactory = obs.factories[playerId][unitId];

        let lichen = 0;
        for (let y = 0; y < board.lichen.length; y++) {
          for (let x = 0; x < board.lichen.length; x++) {
            if (board.lichenStrains[y][x] === rawFactory.strain_id) {
              lichen += board.lichen[y][x];
            }
          }
        }

        factories.push({
          unitId,

          tile: {
            x: rawFactory.pos[0],
            y: rawFactory.pos[1],
          },

          power: rawFactory.power,
          cargo: rawFactory.cargo,

          strainId: rawFactory.strain_id,
          action: actions[playerId][unitId] !== undefined ? parseFactoryAction(actions[playerId][unitId]) : null,
          lichen,
        });
      }

      const robots: Robot[] = [];
      for (const unitId of Object.keys(obs.units[playerId])) {
        const rawRobot = obs.units[playerId][unitId];
        const actionQueue = actions[playerId][unitId] !== undefined ? actions[playerId][unitId] : rawRobot.action_queue;

        robots.push({
          unitId,

          tile: {
            x: rawRobot.pos[0],
            y: rawRobot.pos[1],
          },

          power: rawRobot.power,
          cargo: rawRobot.cargo,

          type: rawRobot.unit_type == 'LIGHT' ? RobotType.Light : RobotType.Heavy,
          actionQueue: actionQueue.map((action: any) => parseRobotAction(action)),
        });
      }

      const rawTeam = obs.teams[playerId];
      teams.push({
        name: teamNames[j],
        faction: rawTeam.faction,

        water: rawTeam.water,
        metal: rawTeam.metal,

        factories,
        robots,

        factoriesToPlace: rawTeam.factories_to_place,
        spawns: steps[0].teams[j].spawns,

        action: obs.real_env_steps < 0 && actions[playerId] !== null ? parseSetupAction(actions[playerId]) : null,
      });
    }

    let weather = Weather.Normal;
    if (obs.real_env_steps >= 0 && obs.real_env_steps < weatherSchedule.length) {
      weather = weatherSchedule[obs.real_env_steps];
    }

    steps.push({
      step: obs.real_env_steps,
      board,
      teams: teams as [Team, Team],
      weather,
    });
  }

  return { steps };
}
