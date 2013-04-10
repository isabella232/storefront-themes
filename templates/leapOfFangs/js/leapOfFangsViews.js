define(["jquery", "backbone", "components", "handlebars", "templates"], function($, Backbone, Components, Handlebars) {

    // Define view types

    var getTemplate = Handlebars.getTemplate,
        triggers = { "click .buy" : "buy" },
        VirtualGoodView = Components.ItemView.extend({
            triggers : triggers,
            template : getTemplate("item")
        }),
        CurrencyPackView = Components.ItemView.extend({
            triggers : triggers,
            template : getTemplate("currencyPack")
        }),
        CategoryMenuItemView = Components.ItemView.extend({
            template : getTemplate("categoryMenuItem")
        }),
        CurrencyMenuItemView = CategoryMenuItemView.extend(),
        CarouselView = Components.CarouselView.extend({
            className           : "category",
            itemViewContainer   : ".goods",
            template            : getTemplate("category")
        });


    var extendViews = function(model) {

        var theme           = model.get("theme"),
            templateHelpers = { images : theme.images };


        // Add template helpers to view prototypes

        VirtualGoodView.prototype.templateHelpers = function() {
            var modelAssets = model.get("modelAssets");
            return _.extend({
                imgFilePath : modelAssets["virtualGoods"][this.model.id],
                currency : {
                    imgFilePath : modelAssets["virtualCurrencies"][this.model.getCurrencyId()]
                },
                price : this.model.get("priceModel").values[this.model.getCurrencyId()],
                item : theme.item
            }, templateHelpers);
        };
        CurrencyPackView.prototype.templateHelpers = function() {
            var modelAssets = model.get("modelAssets");
            return _.extend({
                imgFilePath : modelAssets["currencyPacks"][this.model.id],
                currency : {
                    imgFilePath : modelAssets["virtualCurrencies"][this.model.get("currency_itemId")]
                },
                item : theme.item
            }, templateHelpers);
        };
        CategoryMenuItemView.prototype.templateHelpers = function() {
            var modelAssets = model.get("modelAssets");
            return {
                imgFilePath : modelAssets["categories"][this.model.id]
            };
        };
        CurrencyMenuItemView.prototype.templateHelpers = function() {
            var modelAssets = model.get("modelAssets");
            return {
                imgFilePath : modelAssets["virtualCurrencies"][this.model.id]
            };
        };
    };


    var StoreView = Components.BaseStoreView.extend({
        initialize : function() {
            _.bindAll(this, "changeTitle", "showCurrencyPacks");
            this.dialogModel = this.theme.noFundsModal;


            var categories      = this.model.get("categories"),
                currencies      = this.model.get("virtualCurrencies"),
                templateHelpers = { images : this.theme.images },
                $this           = this;


            this.categoryMenu = new Components.CollectionView({
                collection          : categories,
                itemView            : CategoryMenuItemView,
                onRender            : function() {
                    // Activate tabs
                    this.$("li:first").addClass("active");
                }
            }).on("itemview:select", function(view) {
                $this.playSound().changeActiveView(view);
                var name = view.model.get("name");

                // TODO: Extract to header view that listens to active title changes
                $this.changeTitle(name);
            });


            this.currencyMenu = new Components.CollectionView({
                collection : currencies,
                itemView : CurrencyMenuItemView
            }).on("itemview:select", function(view) {
                $this.playSound().changeActiveView(view);
                var name = view.model.get("name");

                // TODO: Extract to header view that listens to active title changes
                $this.changeTitle(name);
            });

            var wantsToBuyVirtualGoods = _.bind(function(view) {
                this.playSound().wantsToBuyVirtualGoods(view.model);
            }, this);
            var wantsToBuyMarketItem = _.bind(function(view) {
                this.playSound().wantsToBuyMarketItem(view.model);
            }, this);


            // Build views for each category
            this.categoryViews = {};
            categories.each(function(category) {

                var view = new CarouselView({
                    collection          : category.get("goods"),
                    itemView            : VirtualGoodView,
                    templateHelpers     : templateHelpers
                }).on({
                    "next"              : $this.playSound,
                    "previous"          : $this.playSound,
                    "itemview:buy"      : wantsToBuyVirtualGoods
                });

                $this.categoryViews[category.cid] = view;
            });


            // Build views for each currency
            currencies.each(function(currency) {

                var view = new CarouselView({
                    collection          : currency.get("packs"),
                    itemView            : CurrencyPackView,
                    templateHelpers     : templateHelpers
                }).on({
                    "next"              : $this.playSound,
                    "previous"          : $this.playSound,
                    "itemview:buy"      : wantsToBuyMarketItem
                });

                $this.categoryViews[currency.cid] = view;
            });


            // Set the active view to be the first category's view
            // TODO: Use BabySitter
            this.activeView = _.values(this.categoryViews)[0];
        },
        changeTitle : function(text) {
            this.$("#title").html(text);
        },
        changeActiveView : function(view) {
            this.activeView.$el.removeClass("active");
            this.activeView = this.categoryViews[view.model.cid];
            this.activeView.$el.addClass("active");
            return this;
        },
        showCurrencyPacks : function() {
            // When this flag is raised, there is no connectivity,
            // thus don't show the currency store
            if (this.model.get("isCurrencyStoreDisabled")) {
                alert("Buying more is unavailable. Check your internet connectivity and try again.");
            } else {
                this.$("[href=#" + this.currencyPacksId + "]").tab("show");
                var name = this.theme.currencyPacksCategoryName;
                this.activeView = this.categoryViews[name];
                this.changeTitle(name);
            }
        },
        onRender : function() {

            // Append background to element
            // TODO: Remove once this CSS property is injected dynamically from template.json definition
            this.$el.css("background-image", "url('" + this.theme.images.globalBackground + "')");

            // Show first category name in header
            this.changeTitle(this.model.get("categories").at(0).get("name"));

            // Attach event handler to quit button
            this.$("#quit").click(this.leaveStore);

            // Render category menu
            // TODO: Render in separate template
            this.categoryMenu.setElement("#category-menu").render();
            this.currencyMenu.setElement("#currency-menu").render();

            var $this = this;
            _.each(this.categoryViews, function(view) {
                $this.$("#categories").append(view.render().el);
            });

            // Assumes that the active view is the first category view
            this.activeView.$el.addClass("active");
        },
        zoomFunction : function() {
            return (innerHeight / innerWidth) > 1.5 ? (innerWidth / 720) : (innerHeight / 1280);
        }
    });


    return {
        createStoreView : function(options) {

            // Extend local Backbone views with theme specific template helpers
            extendViews(options.storeViewOptions.model);

            // Create store view instance
            return new StoreView(options.storeViewOptions).on("imagesLoaded", options.imagesLoadedCallback).render();
        }
    };
});

// grunt-rigger directive:
//= handlebars-templates
