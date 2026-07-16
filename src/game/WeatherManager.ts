import { GameEngine } from '../engine/GameEngine';

export class WeatherManager {
  private engine: GameEngine;
  private weatherTimer: number = 0;
  private weatherInterval: number = 90; // Weather changes every 90 real seconds

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.triggerRandomWeather();
  }

  public update(deltaSeconds: number): void {
    this.weatherTimer += deltaSeconds;
    if (this.weatherTimer >= this.weatherInterval) {
      this.weatherTimer = 0;
      this.triggerRandomWeather();
    }
  }

  private triggerRandomWeather(): void {
    // Keep it permanently sunny
    this.engine.triggerWeatherChange('sunny');
  }
}
