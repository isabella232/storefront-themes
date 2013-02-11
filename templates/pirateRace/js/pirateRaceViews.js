define(["jquery", "backbone", "components", "marionette", "handlebars", "templates", "iscroll"], function($, Backbone, Components, Marionette, Handlebars) {

    var StoreView = Components.BaseStoreView.extend({
        initialize : function() {
            _.bindAll(this, "showCurrencyStore", "showGoodsStore", "leaveStore");
            this.dialogModel    = this.theme.pages.goods.noFundsModal;
            this.categoryViews  = [];

            var $this           = this,
                currencies      = this.model.get("virtualCurrencies"),
                categories      = this.model.get("categories"),
                nonConsumables  = this.model.get("nonConsumables");


            var sharedGoodsOptions = {
                template        : Handlebars.getTemplate("item"),
                templateHelpers : function() {

                    var modelAssets = $this.model.get("modelAssets");
                    return _.extend({
                        imgFilePath : modelAssets["virtualGoods"][this.model.id],
                        currency : {
                            imgFilePath : modelAssets["virtualCurrencies"][this.model.getCurrencyId()]
                        },
                        price : this.model.get("priceModel").values[this.model.getCurrencyId()],
                        balanceLabelStyle   : $this.theme.common.balanceLabelStyle,
                        itemSeparator       : $this.theme.itemSeparator

                        // TODO: Move all properties under pages.goods.item and pages.currencyPacks.item and migrate DB

                    }, $this.theme.pages.goods.listItem);
                },
                css : { "background-image" : "url('" + $this.theme.pages.goods.listItem.background + "')" }
            };
            var VirtualGoodView = Components.ListItemView.extend(_.extend({
                triggers : {
                    "click .buy" : "buy"
                }
            }, sharedGoodsOptions));

            var EquippableVirtualGoodView = Components.EquippableListItemView.extend(sharedGoodsOptions);

            var CurrencyPackView = Components.ListItemView.extend({
                template        : Handlebars.getTemplate("currencyPack"),
                templateHelpers : function() {

                    var modelAssets = $this.model.get("modelAssets");
                    return {
                        nameStyle       : $this.theme.pages.currencyPacks.listItem.nameStyle,
                        priceStyle      : $this.theme.pages.currencyPacks.listItem.priceStyle,
                        itemSeparator   : $this.theme.itemSeparator,
                        imgFilePath     : modelAssets["currencyPacks"][this.model.id]
                    };
                },
                css             : { "background-image" : "url('" + this.theme.pages.currencyPacks.listItem.balanceBackground + "')" }
            });

            var NonConsumableView = Components.BuyOnceItemView.extend({
                template        : Handlebars.getTemplate("nonConsumableItem"),
                templateHelpers : function() {

                    var modelAssets = $this.model.get("modelAssets");
                    return {
                        nameStyle           : $this.theme.pages.currencyPacks.listItem.nameStyle,
                        priceStyle          : $this.theme.pages.currencyPacks.listItem.priceStyle,
                        itemSeparator       : $this.theme.itemSeparator,
                        ownedIndicatorImage : $this.theme.common.ownedIndicatorImage,
                        imgFilePath         : modelAssets["nonConsumables"][this.model.id]
                    };
                }
            });


            var SectionedListView = Marionette.CompositeView.extend({
                tagName             : "div",
                className           : "items virtualGoods",
                template            : Handlebars.getTemplate("listContainer"),
                itemViewContainer   : ".container"
            });

            categories.each(function(category) {
                categoryGoods = category.get("goods");
                var view;

                if (category.get("name") != "FRIENDS") {
                    view = new SectionedListView({
                        collection          : categoryGoods,
                        itemView            : VirtualGoodView,
                        templateHelpers     :_.extend({category : category.get("name")}, $this.theme.categories)
                    }).on("itemview:buy", function(view) { $this.playSound().wantsToBuyVirtualGoods(view.model); });
                } else {
                    view = new SectionedListView({
                        collection          : categoryGoods,
                        itemView            : EquippableVirtualGoodView,
                        templateHelpers     :_.extend({category : category.get("name")}, $this.theme.categories)
                    }).on({
                        "itemview:buy" : function(view) { $this.playSound().wantsToBuyVirtualGoods(view.model); },
                        "itemview:equip" : function(view) {
                            $this.playSound().wantsToEquipGoods(view.model);
                        },
                        "itemview:equipped" : function(view) {

                            // Make sure to UI-unequip the previous one
                            if (this.equippedView) {
                                this.equippedView.model.set("equipped", false);
                            }
                            this.equippedView = view;
                        }
                    });
                }
                $this.categoryViews.push(view);
            });
            this.currencyPacksView = new Components.CollectionListView({
                className           : "items currencyPacks",
                collection          : currencies.at(0).get("packs"),
                itemView            : CurrencyPackView
            }).on("itemview:selected", function(view) {
                this.playSound().wantsToBuyMarketItem(view.model);
            }, this);

            this.nonConsumablesView = new Components.CollectionListView({
                className           : "items nonConsumables",
                collection          : nonConsumables,
                itemView            : NonConsumableView
            }).on("itemview:buy", function(view) {
                this.playSound().wantsToBuyMarketItem(view.model);
            }, this);

        },
        events : {
            // TODO: Change to timedEvents with `click` once the storeview extends Marionette.View
            "touchend .leave-store" : "leaveStore",
            "touchend .buy-more"    : "showCurrencyStore",
            "touchend .back"        : "showGoodsStore"
        },
        updateBalance : function(model) {
            this.$(".balance-container label").html(model.get("balance"));
        },
        showCurrencyStore : function() {
            this.playSound();

            // When this flag is raised, there is no connectivity,
            // thus don't show the currency store
            if (this.model.get("isCurrencyStoreDisabled")) {
                alert("Buying more " + this.model.get("currency").get("name") + " is unavailable. Check your internet connectivity and try again.");
            } else {
                this.$("#goods-store").hide();
                this.$("#currency-store").show();
            }
        },
        showGoodsStore : function() {
            this.playSound();
            this.$("#currency-store").hide();
            this.$("#goods-store").show();
        },
        leaveStore : function() {
            this.playSound().wantsToLeaveStore();
        },
        onRender : function() {
            var $this = this;
            this.$("#currency-store").hide();

            // Render subviews (items in goods store and currency store)
            _.each(this.categoryViews, function(view) {
                $this.$("#goods-store .items-container [data-iscroll='true']").append(view.render().el);
            });


            this.$("#currency-store .currency-packs").html(this.currencyPacksView.render().el);
            this.$("#currency-store .non-consumables").html(this.nonConsumablesView.render().el);

            // Create IScrolls
            // TODO: remove setTimeouts when heights of lists will be pre-defined
            var goodsIScroll = new iScroll(this.$("#goods-store .items-container")[0], {hScroll: false, vScrollbar: false});
            var packsIScroll = new iScroll(this.$("#currency-store .items-container")[0], {hScroll: false, vScrollbar: false});
            setTimeout(function() {
                goodsIScroll.refresh();
                packsIScroll.refresh();
            }, 1000);

/*
 // Create FastClick buttons
            new FastClick(this.$(".leave-store")[0]);
            new FastClick(this.$(".buy-more")[0]);
            new FastClick(this.$(".back")[0]);
*/
        },
        zoomFunction : function() {
            return Math.min(innerWidth / 560, 1);
        }
    });

    return {
        StoreView : StoreView
    };
});

// grunt-rigger directive:
//= handlebars-templates
