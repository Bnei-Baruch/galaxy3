class ConfigStore {
  static globalConfig = {};

  static PRE_MODERATION_KEY = "galaxy_premod";

  static setGlobalConfig = (config) => {
    ConfigStore.globalConfig = config;
    try {
      ConfigStore.globalConfig.lastModified = new Date(config.last_modified);
    } catch (e) {
      console.error("ConfigStore.setGlobalConfig", e);
    }
  };

  static isNewer = (lastModified) => {
    try {
      return ConfigStore.globalConfig.lastModified < new Date(lastModified);
    } catch (e) {
      return false;
    }
  };

  static dynamicConfig = (key) => {
    return (ConfigStore.globalConfig.dynamic_config || {})[key];
  };

  static setDynamicConfig = (key, value) => {
    ConfigStore.globalConfig.dynamic_config[key] = value;
  };
}

export default ConfigStore;
