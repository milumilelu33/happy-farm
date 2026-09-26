// 游戏入口文件
const GameEngine = require('./src/core/GameEngine');
const SaveSystem = require('./src/systems/SaveSystem');
const ResourceSystem = require('./src/systems/ResourceSystem');
const FarmSystem = require('./src/systems/FarmSystem');
const CropSystem = require('./src/systems/CropSystem');
const AnimalSystem = require('./src/systems/AnimalSystem');
const ShopSystem = require('./src/systems/ShopSystem');
const UpgradeSystem = require('./src/systems/UpgradeSystem');

// 全局游戏实例
App({
  gameEngine: null,
  saveSystem: null,
  resourceSystem: null,
  farmSystem: null,
  cropSystem: null,
  animalSystem: null,
  shopSystem: null,
  upgradeSystem: null,

  onLaunch() {
    try {
      // 初始化各个系统（按依赖顺序）
      this.saveSystem = new SaveSystem();
      try {
        this.saveSystem.load(); // 先加载存档
      } catch (loadErr) {
        console.error('加载存档出错，使用默认存档:', loadErr);
        if (this.saveSystem && this.saveSystem.getDefaultSaveData) {
          this.saveSystem.currentSave = this.saveSystem.getDefaultSaveData();
        }
      }

      this.cropSystem = new CropSystem();
      this.resourceSystem = new ResourceSystem();
      this.upgradeSystem = new UpgradeSystem(this.saveSystem);
      this.animalSystem = new AnimalSystem(this.saveSystem);
      this.farmSystem = new FarmSystem(this.cropSystem, this.saveSystem);
      this.shopSystem = new ShopSystem(this.resourceSystem, this.cropSystem, this.animalSystem, this.upgradeSystem);
      if (this.shopSystem.setSaveSystem) {
        this.shopSystem.setSaveSystem(this.saveSystem); // 设置存档引用
      }

      // 从存档同步资源数据（包括金币、种子、库存等）
      const saveData = this.saveSystem.getCurrentSave ? this.saveSystem.getCurrentSave() : null;
      if (saveData) {
        if (saveData.resources && this.resourceSystem.loadResources) {
          try {
            this.resourceSystem.loadResources(saveData.resources);
          } catch (rErr) {
            console.warn('加载资源出错，忽略:', rErr);
          }
        }
        // 确保金币与玩家数据同步
        if (saveData.player && saveData.player.gold !== undefined && this.resourceSystem.set) {
          try {
            this.resourceSystem.set('gold', saveData.player.gold);
          } catch (gErr) {
            console.warn('同步金币出错，忽略:', gErr);
          }
        }
      }

      // 资源变化时同步回存档
      if (this.resourceSystem.onResourceChanged) {
        this.resourceSystem.onResourceChanged(() => {
          try {
            if (this.saveSystem.updateSave && this.resourceSystem.getAllResources && this.resourceSystem.get) {
              this.saveSystem.updateSave('resources', this.resourceSystem.getAllResources());
              this.saveSystem.updateSave('player.gold', this.resourceSystem.get('gold'));
            }
          } catch (e) {
            console.warn('资源变更保存失败:', e);
          }
        });
      }

      // 初始化游戏引擎
      this.gameEngine = new GameEngine({
        farmSystem: this.farmSystem,
        cropSystem: this.cropSystem,
        animalSystem: this.animalSystem,
        saveSystem: this.saveSystem
      });

      // 启动游戏引擎
      if (this.gameEngine.start) {
        this.gameEngine.start();
      }

      // 启动自动保存
      if (this.saveSystem.startAutoSave) {
        this.saveSystem.startAutoSave();
      }

      console.log('开心农场游戏初始化完成');
    } catch (err) {
      console.error('========== 游戏初始化出错（导致黑屏） ==========');
      console.error('错误详情:', err);
      console.error('错误堆栈:', err && err.stack);
      // 兜底：至少保证各系统有默认值，避免页面访问时全是 undefined
      if (!this.saveSystem) this.saveSystem = { getCurrentSave: () => null, save: () => {}, updateSave: () => {}, startAutoSave: () => {} };
      if (!this.resourceSystem) this.resourceSystem = { get: () => 0, set: () => {}, add: () => {}, consume: () => false, canAfford: () => false, getAllResources: () => ({}), loadResources: () => {}, onResourceChanged: () => {}, onGoldChanged: () => {} };
      if (!this.cropSystem) this.cropSystem = { getCropConfig: () => null };
      if (!this.animalSystem) this.animalSystem = { getAnimalConfig: () => null, getAllAnimals: () => [], getBarnCapacity: () => 4 };
      if (!this.farmSystem) this.farmSystem = { getAllLands: () => [], plantCrop: () => false, harvestCrop: () => null, unlockLand: () => false, getLandCost: () => 999999 };
      if (!this.shopSystem) this.shopSystem = { getShopItems: () => [], canPurchase: () => ({ canBuy: false, reason: '' }), purchase: () => ({ success: false }), getCurrentPrice: () => 0, getTodayPurchased: () => 0, setSaveSystem: () => {} };
      if (!this.upgradeSystem) this.upgradeSystem = { getPlayerLevel: () => 1, getPlayerExp: () => 0, getExpToNext: () => 100, addExperience: () => {} };
    }
  },

  onShow() {
    // 从后台切回前台，计算离线收益
    if (this.gameEngine) {
      this.gameEngine.calculateOfflineEarnings();
    }
  },

  onHide() {
    // 切到后台，保存游戏
    if (this.saveSystem) {
      this.saveSystem.save('auto');
    }
  },

  onError(err) {
    console.error('游戏错误:', err);
  }
});
