import {
  Difficulty,
  Game,
  GameType,
  Gold,
  Player,
  PlayerInfo,
  PlayerType,
  TerrainType,
  TerraNullius,
  Tick,
  UnitInfo,
  UnitType,
} from "../game/Game";
import { GameMap, TileRef } from "../game/GameMap";
import { PlayerView } from "../game/GameView";
import { GameConfig } from "../Schemas";
import { assertNever, within } from "../Util";
import { Config, ServerConfig, Theme } from "./Config";
import { pastelTheme } from "./PastelTheme";

export abstract class DefaultServerConfig implements ServerConfig {
  turnIntervalMs(): number {
    return 100;
  }
  gameCreationRate(): number {
    return 1 * 60 * 1000;
  }
  lobbyLifetime(): number {
    return 2 * 60 * 1000;
  }
}

export class DefaultConfig implements Config {
  constructor(
    private _serverConfig: ServerConfig,
    private _gameConfig: GameConfig
  ) {}
  spawnImmunityDuration(): Tick {
    return 5 * 10;
  }

  gameConfig(): GameConfig {
    return this._gameConfig;
  }

  serverConfig(): ServerConfig {
    return this._serverConfig;
  }

  difficultyModifier(difficulty: Difficulty): number {
    switch (difficulty) {
      case Difficulty.Easy:
        return 1;
      case Difficulty.Medium:
        return 3;
      case Difficulty.Hard:
        return 9;
      case Difficulty.Impossible:
        return 18;
    }
  }

  cityPopulationIncrease(): number {
    return 250_000;
  }

  falloutDefenseModifier(): number {
    return 5;
  }

  defensePostRange(): number {
    return 30;
  }
  defensePostDefenseBonus(): number {
    return 5;
  }
  spawnNPCs(): boolean {
    return true;
  }
  tradeShipGold(dist: number): Gold {
    return 10000 + 100 * Math.pow(dist, 1.1);
  }
  tradeShipSpawnRate(): number {
    return 500;
  }

  unitInfo(type: UnitType): UnitInfo {
    switch (type) {
      case UnitType.TransportShip:
        return {
          cost: () => 0,
          territoryBound: false,
        };
      case UnitType.Warship:
        return {
          cost: (p: Player) => (p.units(UnitType.Warship).length + 1) * 250_000,
          territoryBound: false,
          maxHealth: 1000,
        };
      case UnitType.Shell:
        return {
          cost: () => 0,
          territoryBound: false,
          damage: 250,
        };
      case UnitType.Port:
        return {
          cost: (p: Player) =>
            Math.min(
              1_000_000,
              Math.pow(2, p.units(UnitType.Port).length) * 250_000
            ),
          territoryBound: true,
          constructionDuration: 2 * 10,
        };
      case UnitType.AtomBomb:
        return {
          cost: () => 750_000,
          territoryBound: false,
        };
      case UnitType.HydrogenBomb:
        return {
          cost: () => 5_000_000,
          territoryBound: false,
        };
      case UnitType.MIRV:
        return {
          cost: () => 5_000_000,
          territoryBound: false,
        };
      case UnitType.MIRVWarhead:
        return {
          cost: () => 0,
          territoryBound: false,
        };
      case UnitType.TradeShip:
        return {
          cost: () => 0,
          territoryBound: false,
        };
      case UnitType.MissileSilo:
        return {
          cost: () => 1_000_000,
          territoryBound: true,
          constructionDuration: 10 * 10,
        };
      case UnitType.DefensePost:
        return {
          cost: (p: Player) =>
            Math.min(
              250_000,
              (p.units(UnitType.DefensePost).length + 1) * 50_000
            ),
          territoryBound: true,
          constructionDuration: 5 * 10,
        };
      case UnitType.City:
        return {
          cost: (p: Player) =>
            Math.min(
              1_000_000,
              Math.pow(2, p.units(UnitType.City).length) * 125_000
            ),
          territoryBound: true,
          constructionDuration: 2 * 10,
        };
      case UnitType.Construction:
        return {
          cost: () => 0,
          territoryBound: true,
        };
      default:
        assertNever(type);
    }
  }
  defaultDonationAmount(sender: Player): number {
    return Math.floor(sender.troops() / 3);
  }
  donateCooldown(): Tick {
    return 10 * 10;
  }
  emojiMessageDuration(): Tick {
    return 5 * 10;
  }
  emojiMessageCooldown(): Tick {
    return 15 * 10;
  }
  targetDuration(): Tick {
    return 10 * 10;
  }
  targetCooldown(): Tick {
    return 15 * 10;
  }
  allianceRequestCooldown(): Tick {
    return 30 * 10;
  }
  allianceDuration(): Tick {
    return 600 * 10;
  }
  percentageTilesOwnedToWin(): number {
    return 80;
  }
  boatMaxNumber(): number {
    return 3;
  }
  boatMaxDistance(): number {
    return 500;
  }
  numSpawnPhaseTurns(): number {
    return this._gameConfig.gameType == GameType.Singleplayer ? 100 : 300;
  }
  numBots(): number {
    return 400;
  }
  theme(): Theme {
    return pastelTheme;
  }

  attackLogic(
    gm: Game,
    attackTroops: number,
    attacker: Player,
    defender: Player | TerraNullius,
    tileToConquer: TileRef
  ): {
    attackerTroopLoss: number;
    defenderTroopLoss: number;
    tilesPerTickUsed: number;
  } {
    let mag = 0;
    let speed = 0;
    const type = gm.terrainType(tileToConquer);
    switch (type) {
      case TerrainType.Plains:
        mag = 80;
        speed = 15;
        break;
      case TerrainType.Highland:
        mag = 100;
        speed = 20;
        break;
      case TerrainType.Mountain:
        mag = 120;
        speed = 25;
        break;
      default:
        throw new Error(`terrain type ${type} not supported`);
    }
    if (defender.isPlayer()) {
      for (const dp of gm.nearbyDefensePosts(tileToConquer)) {
        if (dp.owner() == defender) {
          mag *= this.defensePostDefenseBonus();
          speed *= this.defensePostDefenseBonus();
          break;
        }
      }
    }

    if (gm.hasFallout(tileToConquer)) {
      mag *= this.falloutDefenseModifier();
      speed *= this.falloutDefenseModifier();
    }

    if (attacker.isPlayer() && defender.isPlayer()) {
      if (
        attacker.type() == PlayerType.Human &&
        defender.type() == PlayerType.Bot
      ) {
        mag *= 0.8;
      }
      if (
        attacker.type() == PlayerType.FakeHuman &&
        defender.type() == PlayerType.Bot
      ) {
        mag *= 0.8;
      }
    }

    if (defender.isPlayer()) {
      return {
        attackerTroopLoss:
          within(defender.troops() / (2.5 * attackTroops), 0.1, 10) * mag,
        defenderTroopLoss: defender.troops() / defender.numTilesOwned(),
        tilesPerTickUsed:
          within(defender.troops() / (5 * attackTroops), 0.2, 1.5) * speed,
      };
    } else {
      return {
        attackerTroopLoss:
          attacker.type() == PlayerType.Bot ? mag / 10 : mag / 5,
        defenderTroopLoss: 0,
        tilesPerTickUsed: within(
          (2000 * Math.max(10, speed)) / attackTroops,
          5,
          100
        ),
      };
    }
  }

  attackTilesPerTick(
    attackTroops: number,
    attacker: Player,
    defender: Player | TerraNullius,
    numAdjacentTilesWithEnemy: number
  ): number {
    if (defender.isPlayer()) {
      return (
        within(((5 * attackTroops) / defender.troops()) * 2, 0.01, 0.5) *
        numAdjacentTilesWithEnemy *
        3
      );
    } else {
      return numAdjacentTilesWithEnemy * 2;
    }
  }

  boatAttackAmount(attacker: Player, defender: Player | TerraNullius): number {
    return Math.floor(attacker.troops() / 5);
  }

  attackAmount(attacker: Player, defender: Player | TerraNullius) {
    if (attacker.type() == PlayerType.Bot) {
      return attacker.troops() / 20;
    } else {
      return attacker.troops() / 5;
    }
  }

  startManpower(playerInfo: PlayerInfo): number {
    if (playerInfo.playerType == PlayerType.Bot) {
      return 10_000;
    }
    if (playerInfo.playerType == PlayerType.FakeHuman) {
      switch (this._gameConfig.difficulty) {
        case Difficulty.Easy:
          return 2_500 * (playerInfo?.nation?.strength ?? 1);
        case Difficulty.Medium:
          return 5_000 * (playerInfo?.nation?.strength ?? 1);
        case Difficulty.Hard:
          return 15_000 * (playerInfo?.nation?.strength ?? 1);
        case Difficulty.Impossible:
          return 20_000 * (playerInfo?.nation?.strength ?? 1);
      }
    }
    return 25_000;
  }

  maxPopulation(player: Player | PlayerView): number {
    let maxPop = Math.pow(player.numTilesOwned(), 0.6) * 1000 + 50000;
    if (player.type() == PlayerType.Bot) {
      return maxPop;
    }
    return (
      maxPop * 2 +
      player.units(UnitType.City).length * this.cityPopulationIncrease()
    );
  }

  populationIncreaseRate(player: Player): number {
    let max = this.maxPopulation(player);

    let toAdd = 10 + Math.pow(player.population(), 0.73) / 4;

    const ratio = 1 - player.population() / max;
    toAdd *= ratio;

    if (player.type() == PlayerType.Bot) {
      toAdd *= 0.7;
    }
    let difficultyMultiplier = 1;
    switch (this._gameConfig.difficulty) {
      case Difficulty.Easy:
        difficultyMultiplier = 0.3;
        break;
      case Difficulty.Medium:
        difficultyMultiplier = 0.5;
        break;
      case Difficulty.Hard:
        difficultyMultiplier = 1;
        break;
      case Difficulty.Impossible:
        difficultyMultiplier = 1.2;
        break;
    }
    if (player.type() == PlayerType.FakeHuman) {
      toAdd *= difficultyMultiplier;
    }

    return Math.min(player.population() + toAdd, max) - player.population();
  }

  goldAdditionRate(player: Player): number {
    return Math.sqrt(player.workers() * player.numTilesOwned()) / 200;
  }

  troopAdjustmentRate(player: Player): number {
    const maxDiff = this.maxPopulation(player) / 1000;
    const target = player.population() * player.targetTroopRatio();
    const diff = target - player.troops();
    if (Math.abs(diff) < maxDiff) {
      return diff;
    }
    const adjustment = maxDiff * Math.sign(diff);
    // Can ramp down troops much faster
    if (adjustment < 0) {
      return adjustment * 5;
    }
    return adjustment;
  }
}
