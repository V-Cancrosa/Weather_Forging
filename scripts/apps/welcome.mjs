import { MODULE_ID } from "../constants.mjs";
import { CHANGELOG } from "../changelog.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Welcome window: quick start and what's new. Shown to GMs once per version. */
export class WelcomeWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-welcome`,
    classes: [MODULE_ID, "wf-welcome-app"],
    window: { title: "WEATHERFORGING.Welcome.Title", icon: "fa-solid fa-cloud-sun-rain" },
    position: { width: 520, height: "auto" },
    actions: {
      openPanel: WelcomeWindow.#onOpenPanel
    }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/welcome.hbs` }
  };

  /** Called on ready: show to GMs when the module version changed. */
  static async showIfNew() {
    if (!game.user.isGM) return;
    const version = game.modules.get(MODULE_ID).version;
    if (game.settings.get(MODULE_ID, "lastWelcome") === version) return;
    await new WelcomeWindow().render({ force: true });
    await game.settings.set(MODULE_ID, "lastWelcome", version);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const lang = game.i18n.lang === "pl" ? "pl" : "en";
    return Object.assign(context, {
      version: game.modules.get(MODULE_ID).version,
      releases: CHANGELOG.slice(0, 3).map((r, i) => ({ version: r.version, items: r[lang], latest: i === 0 })),
      isGM: game.user.isGM
    });
  }

  static #onOpenPanel() {
    game.modules.get(MODULE_ID).api.openPanel();
    this.close();
  }
}
