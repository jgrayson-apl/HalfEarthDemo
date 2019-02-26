/*
  Copyright 2017 Esri

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.​
*/

define([
  "calcite",
  "dojo/_base/declare",
  "ApplicationBase/ApplicationBase",
  "dojo/i18n!./nls/resources",
  "dojo/number",
  "dojo/date/locale",
  "dojo/on",
  "dojo/query",
  "dojo/dom",
  "dojo/dom-class",
  "dojo/dom-construct",
  "esri/identity/IdentityManager",
  "esri/core/Evented",
  "esri/core/watchUtils",
  "esri/core/promiseUtils",
  "esri/portal/Portal",
  "esri/WebScene",
  "esri/Basemap",
  "esri/views/SceneView",
  "esri/layers/Layer",
  "esri/layers/GroupLayer",
  "esri/layers/WebTileLayer",
  "esri/geometry/Point",
  "esri/geometry/Extent",
  "esri/Graphic",
  "esri/widgets/Feature",
  "esri/widgets/Home",
  "esri/widgets/Search",
  "esri/widgets/BasemapGallery",
  "esri/widgets/Expand"
], function (calcite, declare, ApplicationBase, i18n,
             number, locale, on, query, dom, domClass, domConstruct,
             IdentityManager, Evented, watchUtils, promiseUtils,
             Portal, WebScene, Basemap, SceneView,
             Layer, GroupLayer, WebTileLayer, Point, Extent,
             Graphic, Feature, Home, Search, BasemapGallery, Expand) {

  return declare([Evented], {

    /**
     *
     */
    constructor: function () {
      // LOADING CSS //
      this.CSS = { loading: "configurable-application--loading" };
      // CALCITE WEB //
      calcite.init();
    },

    /**
     *
     * @param base
     */
    init: function (base) {
      if(!base) {
        console.error("ApplicationBase is not defined");
        return;
      }

      //
      // ANOTHER OPTION IS TO CREATE THE MAP AND VIEW VIA CODE
      // AND NOT USE A WEBSCENE FROM ARCGIS ONLINE...
      //

      // APPLICATION SPECIFIC //
      const config = base.config;
      const results = base.results;
      if(results.webSceneItems.length) {

        // WEBSCENE ITEM //
        const webSceneItem = results.webSceneItems[0].value;

        // TITLE //
        config.title = (config.title || webSceneItem.title);

        // MAP //
        const map = new WebScene({ portalItem: webSceneItem });
        map.loadAll().then(() => {
          // VIEW //
          const view = new SceneView({
            container: "view-container",
            map: map
          });
          view.when(() => {
            domClass.remove(document.body, this.CSS.loading);
            this.viewReady(config, webSceneItem, view);
          });
        });

      } else {
        console.error("Could not load an item to display");
      }
    },

    /**
     *
     * @param config
     * @param item
     * @param view
     */
    viewReady: function (config, item, view) {

      // TITLE //
      dom.byId("app-title-node").innerHTML = document.title = config.title;

      // LOADING //
      const updating_node = domConstruct.create("div", { className: "view-loading-node loader" });
      domConstruct.create("div", { className: "loader-bars" }, updating_node);
      domConstruct.create("div", { className: "loader-text font-size--3 text-white", innerHTML: "Updating..." }, updating_node);
      view.ui.add(updating_node, "bottom-right");
      watchUtils.init(view, "updating", (updating) => {
        domClass.toggle(updating_node, "is-active", updating);
      });

      // SEARCH //
      const search = new Search({ view: view });
      const searchExpand = new Expand({
        view: view,
        content: search,
        expandIconClass: "esri-icon-search",
        expandTooltip: "Search"
      });
      view.ui.add(searchExpand, { position: "top-left", index: 0 });

      // BASEMAPS //
      const basemapGalleryExpand = new Expand({
        view: view,
        content: new BasemapGallery({ view: view }),
        expandIconClass: "esri-icon-basemap",
        expandTooltip: "Basemap"
      });
      view.ui.add(basemapGalleryExpand, { position: "top-left", index: 1 });

      // HOME //
      const home = new Home({ view: view });
      view.ui.add(home, { position: "top-left", index: 2 });

      // HALF EARTH //
      this.initializeHalfEarthLayers(view);

      // HIGHLIGHT //
      this.initializeHighlight(view);

    },

    /**
     *
     * @param view
     */
    initializeHalfEarthLayers: function (view) {

      const build_url_template = (type, category) => {
        return `https://storage.googleapis.com/cdn.mol.org/half-earth/tiles/phase2/${category}/${type}/{level}/{col}/{row}`;
      };

      const theme_infos = [
        {
          title: "Terrestrial Species",
          scale: "~110km",
          services: [
            { type: "all", label: "All", categories: ["rarity", "richness"] },
            { type: "birds", label: "Birds", categories: ["rarity", "richness"] },
            { type: "cacti", label: "Cacti", categories: ["rarity", "richness"] },
            { type: "conifers", label: "Conifers", categories: ["rarity", "richness"] },
            { type: "mammals", label: "Mammals", categories: ["rarity", "richness"] },
            { type: "turtles", label: "Turtles", categories: ["rarity", "richness"] }
          ]
        },
        {
          title: "Marine Species",
          scale: "~50km",
          services: [
            { type: "fishes", label: "Fishes", categories: ["rarity", "richness"] }
          ]
        },
        {
          title: "Featured",
          scale: "1km",
          services: [
            { type: "hummingbirds", label: "Hummingbirds", categories: ["rarity_1km", "richness_1km"] }
          ]
        },
        {
          title: "South Africa",
          scale: "1km",
          services: [
            { type: "amphibians", label: "Amphibians", categories: ["rarity_1km", "richness_1km"] },
            { type: "birds", label: "Birds", categories: ["rarity_1km", "richness_1km"] },
            { type: "dragonflies", label: "Dragonflies", categories: ["rarity_1km", "richness_1km"] },
            { type: "mammals", label: "Mammals", categories: ["rarity_1km", "richness_1km"] },
            { type: "protea", label: "Protea", categories: ["rarity_1km", "richness_1km"] },
            { type: "reptiles", label: "Reptiles", categories: ["rarity_1km", "richness_1km"] },
            { type: "restio", label: "Restio", categories: ["rarity_1km", "richness_1km"] },
          ]
        }
      ];

      const left_container = dom.byId("left-container");
      theme_infos.reverse().forEach(theme_info => {

        const panel = domConstruct.create("div", { className: "panel panel-blue trailer-quarter" }, left_container, "first");

        const theme_title_node = domConstruct.create("div", { className: "icon-ui-down esri-interactive trailer-quarter", innerHTML: theme_info.title }, panel);
        on(theme_title_node, "click", () => {
          domClass.toggle(theme_title_node, "icon-ui-down icon-ui-right");
          query(".service-panel", panel).toggleClass("hide");
        });

        domConstruct.create("span", { className: "font-size--3 avenir-italic right", innerHTML: theme_info.scale }, theme_title_node);


        theme_info.services.forEach(service_info => {

          const type_layer = new GroupLayer({ title: service_info.label, visibilityMode: "exclusive", visible: false });
          view.map.add(type_layer);

          // SERVICE PANEL //
          const service_panel = domConstruct.create("div", { className: "service-panel panel text-off-black trailer-quarter" }, panel);

          // SERVICE SWITCH
          const service_switch = domConstruct.create("label", { className: "service-switch toggle-switch leader-half trailer-quarter" }, service_panel);
          const service_input = domConstruct.create("input", { type: "checkbox", className: "toggle-switch-input" }, service_switch);
          on(service_input, "change", () => {
            query(".categories-node", service_panel).toggleClass("hide");
            type_layer.visible = service_input.checked;
          });
          domConstruct.create("span", { className: "toggle-switch-track margin-right-half" }, service_switch);
          domConstruct.create("span", { className: "toggle-switch-label font-size--1", innerHTML: service_info.label }, service_switch);


          //
          // CATEGORIES
          //
          const categories_node = domConstruct.create("div", { className: "categories-node animate-fade-in right hide" }, service_panel, "first");
          const categories_list = domConstruct.create("fieldset", { className: "radio-group font-size--3 trailer-0" }, categories_node);
          service_info.categories.forEach((category, categoryIdx) => {
            const name = `${theme_info.title}-${service_info.type}`;
            const id = `${name}-${category}`;

            const layer = new WebTileLayer({
              title: id,
              urlTemplate: build_url_template(service_info.type, category),
              visible: (categoryIdx === 0),
              opacity: 0.8
            });
            type_layer.layers.add(layer);

            const category_input = domConstruct.create("input", { id: id, name: name, type: "radio", className: "radio-group-input", checked: (categoryIdx === 0) }, categories_list);
            on(category_input, "change", () => {
              if(category_input.checked) {
                layer.visible = true;
              }
            });
            domConstruct.create("label", { for: id, className: "radio-group-label trailer-0", innerHTML: category }, categories_list);

          });
        });

        theme_title_node.click();

      });

    },

    /**
     *
     * @param view
     */
    initializeHighlight: function (view) {

      // Firefly Basemap With Labels //
      //view.map.basemap = new Basemap({ portalItem: { id: "43ba24f2666c4fa3a3ec2079656d40e7" } });


      //
      // FEATURE - DISPLAY FEATURE CONTENT BASED ON FEATURE.POPUPTEMPLATE OR FEATURE.LAYER.POPUPTEMPLATE
      //
      const feature_widget = new Feature({
        container: "selected-feature-node",
        view: view
      });

      //
      // INFO PANEL //
      //
      const info_panel = domConstruct.create("div", {
        className: "panel panel-blue font-size-2 animate-fade-in",
        innerHTML: "Zoom in to view species info..."
      });
      view.ui.add(info_panel, "top-right");

      // TILED INDEX GRID //
      const indexGridsTiledLayer = view.map.layers.find(layer => {
        return (layer.title === "Index Grids Tiled");
      });
      indexGridsTiledLayer.load().then(() => {
        /*...*/
      });

      //
      // FEATURE INDEX GRIDS //
      //
      const index_layer_titles = ["Index Grid Land", "Index Grid Water"];
      const index_layer_views = new Map();
      view.map.layers.forEach(indexLayer => {
        if(index_layer_titles.includes(indexLayer.title)) {
          // WAIT FOR LAYER TO BE LOADED //
          indexLayer.load().then(() => {

            // OVERRIDE DEFAULT MIN SCALE //
            indexLayer.minScale = 10000000;
            // MAKE LAYER VISIBLE
            indexLayer.visible = true;

            // GET LAYERVIEW WHEN READY //
            view.whenLayerView(indexLayer).then(indexLayerView => {
              // SET LAYERVIEW BASED ON LAYER //
              index_layer_views.set(indexLayer, indexLayerView);

              //
              // INDEX LAYER SUSPENDED //
              //   TODO: WE ONLY NEED THIS ON ONE OF THE LAYERS...
              //
              indexLayerView.watch("suspended", suspended => {
                view.container.style.cursor = suspended ? "default" : "pointer";
                domClass.toggle(info_panel, "hide", !suspended);
                if(suspended) {
                  feature_widget.graphic = null;
                }
              });

            });
          });
        }
      });

      //
      // FIND INDEX GRID BASED ON POINTER EVENT //
      //
      const findIndexGrid = (evt) => {
        return view.hitTest(evt).then(hitTestResponse => {
          const binResult = hitTestResponse.results.find(result => {
            return (result.graphic && result.graphic.layer && index_layer_titles.includes(result.graphic.layer.title));
          });
          return (binResult) ? binResult.graphic : null;
        });
      };

      //
      // VIEW HIGHLIGHT OPTIONS //
      //
      view.highlightOptions = {
        color: "white",
        haloOpacity: 0.8,
        fillOpacity: 0.2
      };

      //
      // VIEW POINTER MOVE - HIGHLIGHT INDEX GRID CELL //
      //
      let highlight = null;
      view.on("pointer-move", evt => {
        highlight && highlight.remove();
        findIndexGrid(evt).then(indexGridFeature => {
          if(indexGridFeature) {
            const layerView = index_layer_views.get(indexGridFeature.layer);
            if(layerView) {
              highlight = layerView.highlight(indexGridFeature);
              feature_widget.graphic = indexGridFeature;
            } else {
              feature_widget.graphic = null;
            }
          }
        });
      });


      //
      // VIEW CLICK - GOTO INDEX GRID CELL AND TILT THE VIEW //
      //
      view.on("click", evt => {
        findIndexGrid(evt).then(indexGridFeature => {
          if(indexGridFeature) {
            view.goTo({
              target: indexGridFeature,
              //heading: 0.0,
              scale: 1000000,
              tilt: 60.0
            })
          }
        });
      });


    }
  });

});