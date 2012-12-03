/* =========================================================
 * backbone.extensions.js
 * http://www.github.com/pawartur/backbone.extensions
 * =========================================================
 * Copyright 2012
 *
 * Created By:
 * Artur Wdowiarski
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================= */

(function($, _, Backbone) {
    // A slightly modified Backbone model
    // It allows for defining different urls for different actions (this is for non-RESTful APIs)
    // It also send's model's attributes as query_params and not as attrs of one serialized object
    Backbone.ExtendedModel = Backbone.Model.extend({
        save: function(attributes, options){
            options = options ? options : {};
            var data = options.data ? options.data : $.extend(this.attributes, attributes);
            _.each(data, function(value, key){
                if (_.isObject(value) && value.id) {
                    data[key] = value.id;
                }else if(_.isArray(value) && !isNaN(value[0])){
                    data[key] = value[0];
                }else if (value === null){
                    data[key] = "";
                }
            });
            options.data = $.param(data);
            if (!options.url) {
                if (this.isNew()) {
                    options.url = this.get_add_url ? this.get_add_url() : this.url();
                }else{
                    options.url = this.get_update_url ? this.get_update_url() : this.url();
                }
            }
            Backbone.Model.prototype.save.call(this, attributes, options);
        },
        destroy: function(options){
            if (!options.url) {
                options.url = this.get_delete_url ? this.get_delete_url() : this.url();
            }
            Backbone.Model.prototype.destroy.call(this, options);
        },
        parse: function(resp, xhr) {
            return resp.object;
        },
        url: function(){
            var url = Backbone.Model.prototype.url.apply(this, arguments);
            if (url.slice(-1) != '/')
                return url + '/'; // It's nice when all urls end with a slash...
            return url;
        }
    });


    Backbone.ExtendedCollection = Backbone.Collection.extend({
        model: Backbone.ExtendedModel,
        initialize: function(models, options){
            _.bindAll(
                this,
                'apply_filters'
            );
            this.filters = {};
        },
        parse: function(response){
            var self = this;
            var submodels = [];
            _(response.object_list).each(function(value, key){
                var model = new self.model(value);
                submodels.push(model);
            });
            return submodels;
        },
        where: function(attrs) {
            if (_.isEmpty(attrs)) return [];

            var test_func = function(model){
                for (var key in attrs) {
                    if (_.isObject(attrs[key])) {
                        var model_val = model.get(key);
                        if (!_.isObject(model_val)) {
                            return false;
                        }
                        for (var inner_key in attrs[key]){
                            if (attrs[key][inner_key] != model_val[inner_key]) return false;
                        }
                    }else{
                        if (attrs[key] !== model.get(key)) return false;
                    }
                }
                return true;
            }

            return this.filter(test_func);
        },
        apply_filters: function(filters){
            var self = this;
            _.each(filters, function(value, key){
                if (value) {
                    self.filters[key] = value;
                }else{
                    delete self.filters[key];
                }
            });
            self.trigger("filters_set", filters);
            self.reset();
            self.fetch({add: true});
        },
        fetch: function(options){
            var params_string = $.param(this.filters);
            var url;
            if (this.url && params_string) {
                url = _.isFunction(this.url) ? this.url() : this.url;
                url += '?' + params_string;
                options.url = url;
            }
            Backbone.Collection.prototype.fetch.call(this, options);
        }
             
    });


    // A view for adding a model to a collection by means
    // of a form displayed in a bootstrap modal
    Backbone.AddView = Backbone.View.extend({
        model: null,
        template: null,
        events: {
            'click *[data-action="add_object"]': 'add_object',
            'click *[data-action="show_add_object_modal"]': 'show_add_object_modal',
        },
        initialize: function(){
            _.bindAll(
                this,
                'destroy',
                'get_template_context',
                'render',
                'unrender',
                'bind_events',
                'unbind_events',
                'show_add_object_modal',
                'add_object',
                'preprocess_data',
                'addition_succeeded',
                'addition_failed'
            );
            this.bind_events();
        },
        destroy: function(){
            this.unbind_events();
            this.unrender();
        },
        bind_events: function(){
            this.collection.on("filters_set", this.render);
        },
        unbind_events: function(){
            this.collection.off("filters_set", this.render);
        },
        unrender: function(){
            this.$el.empty();
        },
        get_template_context: function(){
            return {};
        },
        render: function(){
            var template_context = this.get_template_context();
            var compiledTemplate = _.template(this.template, template_context);
            this.$el.html(compiledTemplate);
            this.$add_object_modal = this.$(".modal");
            this.$add_object_modal.modal({show: false});
            return this;
        },
        show_add_object_modal: function(evt){
            this.$add_object_modal.modal("show");
        },
        add_object: function(evt){
            evt.preventDefault();
            var data = {};
            var $element;
            this.$("input, select, textarea").each(function(index, element){
                $element = $(element);
                data[$element.attr("name")] = $element.val();
            });

            data = this.preprocess_data(data);

            var options = {
                wait: true,
                success: this.addition_succeeded,
                error: this.addition_failed
            };
            this._next = $(evt.currentTarget).data("next");
            var new_model = new this.model();
            new_model.save(data, options);
        },
        preprocess_data: function(data){
            return data;
        },
        addition_succeeded: function(new_model, response){
            this.$("input, select, textarea").not('[type="hidden"]').each(function(index, element){
                $(element).val("");
            });
            this.$(".control-group.error").removeClass("error");
            this.$(".errors-info").html("");
            if (this._next == "hide") {
                this.$add_object_modal.modal("hide");
            }
            this.collection.add(new_model, {at: 0});
            this.collection.trigger('manual_add', new_model);
            delete this._next;
        },
        addition_failed: function(new_model, response, options){
            var self = this;
            var content = JSON.parse(response.responseText);
            var $errors;
            _.each(content.errors, function(errors, field_name){
                self.$("*[name="+field_name+"]").closest(".control-group").addClass("error");
                $errors = self.$(".errors_"+field_name);
                _.each(errors, function(error){
                    $errors.append(error+" ");
                });
            });
        }
    });


    // A view that has several subviews of the same type
    Backbone.ComplexView = Backbone.View.extend({
        item_view: null,
        template: null,
        subview_elem_template : "<div></div>",
        initialize: function(){
            _.bindAll(
                this,
                'destroy',
                'render',
                'render_subview',
                'insert_subview',
                'get_template_context',
                'get_subview_options',
                'get_subview_identifier',
                'get_subview_render_options',
                'unrender',
                'unrender_subviews',
                'remove_subviews',
                'get_items',
                'bind_events',
                'unbind_events',
                'bind_subview_events',
                'unbind_subview_events',
                'add_subview',
                'remove_subview'
            );
            this.subviews = {};
            this.bind_events();
        },
        destroy: function(){
            this.unbind_events();
            this.undelegateEvents();
            this.unrender();
        },
        bind_events: function(){
            
        },
        unbind_events: function(){
            var self = this;
            _.each(self.subviews, function(subview, identifier){
                self.unbind_subview_events(subview);
            });
        },
        bind_subview_events: function(subview){
            
        },
        unbind_subview_events: function(subview){
            
        },
        unrender: function(){
            this.$el.empty();
        },
        unrender_subviews: function(){
            _.each(this.subviews, function(subview, identifier){
                subview.unrender();
            });
        },
        remove_subviews: function(){
            var self = this;
            _.each(this.subviews, function(subview, identifier){
                self.remove_subview(subview);
            });
        },
        get_items: function(){
            return [];
        },
        render: function(){
            var self = this;
            var template_context = self.get_template_context();
            var compiledTemplate = _.template(self.template, template_context);
            self.$el.html(compiledTemplate);

            _.each(self.get_items(), function(item){
                var subview_options = self.get_subview_options(item);
                self.render_subview(subview_options);
            });
            return self;
        },
        render_subview: function(options){
            var subview = new this.item_view(options);
            this.insert_subview(subview);
            var render_options = this.get_subview_render_options();
            subview.render(render_options);
            this.subviews[this.get_subview_identifier(subview)] = subview;
            this.bind_subview_events(subview);
        },
        get_template_context: function(){

        },
        get_subview_options: function(item){
            return {
                el: $(this.subview_elem_template),
                item: item
            }
        },
        get_subview_identifier: function(subview){
            return subview.cid;
        },
        get_subview_render_options: function(){

        },
        insert_subview: function(subview){

        },
        add_subview: function(evt){
            evt.preventDefault();
            this.render_subview(this.get_subview_options());
        },
        remove_subview: function(subview){
            subview.unrender();
            subview.$el.remove();
            delete this.subviews[subview.model ? subview.model.get("id") : subview.cid];
        }
    });

    // A view intended for constructing subviews of a ListView
    // defined below.
    Backbone.ListItemView = Backbone.View.extend({
        template: null,
        editing_template: null,
        item_model: null,
        events: {
            'click *[data-action="save_item"]': 'save_item',
            'click *[data-action="remove_item"]': 'remove_item',
            'click *[data-action="show_item_details"]': 'show_item_details'
        },
        initialize: function(){
            _.bindAll(
                this,
                'render',
                'unrender',
                '_set_info',
                'set_success_info',
                'set_error_info',
                'save_item',
                'get_item_model_options',
                'remove_item',
                'show_item_details',
                'save_succeeded',
                'change_save_button_after_success',
                'creation_succeeded',
                'save_failed',
                'remove_failed'
            );
        },
        render: function(options){
            options = $.extend({}, options);
            var template;
            if (options.is_editing) {
                template = this.editing_template;
            }else{
                template = this.template;
            }
            var compiledTemplate = _.template(template, {model: this.model});
            this.$el.html(compiledTemplate);
        },
        unrender: function(){
            this.$el.empty();
        },
        _set_info: function(message_class, message){
            var self = this;
            self.$el.addClass(message_class);
            self.$(".help-inline").html(message);
            setTimeout(function(){
                self.$el.removeClass(message_class);
                self.$(".help-inline").html("");
            }, 5000);
        },
        set_success_info: function(message){
            this._set_info('success', message);
        },
        set_error_info: function(message){
            this._set_info('error', message);
        },
        save_item: function(evt){
            evt.preventDefault();
            var $inputs = $(evt.currentTarget).closest(".control-group").find("input");
            var data = this.get_item_model_options($inputs);
            var options = {
                error: this.save_failed
            }
            if (this.model) {
                options.success = this.save_succeeded;
            }else{
                options.success = this.creation_succeeded;
                this.model = new this.item_model(data);
            }
            this.model.save(data, options);
        },
        get_item_model_options: function($inputs){
            return {name: $inputs.val()};
        },
        remove_item: function(evt){
            evt.preventDefault();
            if (this.model) {
                var options = {
                    error: this.remove_failed,
                    wait: true
                }
                this.model.destroy(options)
            }else{
                this.trigger("remove_empty_line_clicked", this);
            }
        },
        show_item_details: function(evt){
            evt.preventDefault();
            this.trigger("show_details", this);
        },
        save_succeeded: function(model, response, options){
            this.set_success_info("Successfully saved!");
        },
        creation_succeeded: function(model, response, options){
            this.model.set("id", response["object"]["id"], {silent: true});
            this.trigger("created_model", this, model);
            this.change_save_button_after_success(this.$('button[data-action="save_item"]'))
            this.set_success_info("Successfully saved!");
        },
        change_save_button_after_success: function($button_elem){
            $button_elem.html("Change");
        },
        save_failed: function(model, response, options){
            this.set_error_info("Save failed!");
        },
        remove_failed: function(model, response, options){
            this.set_error_info("Deletion failed!");
        }
    });


    // A details view indended for use with ListView defined below
    Backbone.DetailsView = Backbone.View.extend({
        template: null,
        editing_template: null,
        events: {
            "click *[data-action='edit']": "start_edition",
            "click *[data-action='save']": "save",
            "click *[data-action='cancel']": "cancel_edition",
            "click *[data-action='delete']": "delete_object",
            "click *[data-action='hide']": "hide"
        },
        initialize: function(){
            _.bindAll(
                this,
                'destroy',
                'render',
                'unrender',
                'bind_events',
                'unbind_events',
                'get_template_context',
                'start_edition',
                'cancel_edition',
                'save',
                'preprocess_data',
                'delete_object',
                'save_succeeded',
                'save_failed',
                'delete_failed',
                'hide',
                'model_changed'
            );
            this.bind_events();
        },
        destroy: function(){
            this.unbind_events();
            this.unrender();
        },
        bind_events: function(){
            this.model.on("change", this.model_changed);
        },
        unbind_events: function(){
            this.model.off("change", this.model_changed);
        },
        unrender: function(){
            this.unbind_todo_alert_collection();
            this.todo_alert_manager.unrender();
            this.$el.empty();
        },
        render: function(options){
            options = $.extend({}, options);
            var template;
            if (options.is_editing) {
                template = this.editing_template;
            }else{
                template = this.template;
            }
            var context = this.get_template_context();
            var compiledTemplate = _.template(template, context);
            this.$el.html(compiledTemplate);
        },
        get_template_context: function(){
            return {
                model: this.model
            }
        },
        start_edition: function(evt){
            this.render({is_editing: true});
        },
        cancel_edition: function(evt){
            this.render({is_editing: false});
        },
        save: function(evt){
            evt.preventDefault();

            var $input, data = {};
            this.$form.find("input, select, textarea").each(function(index, elem){
                $input = $(elem);
                data[$input.attr("name")] = $input.val();
            });

            data = this.preprocess_data(data);

            var options = {
                error: this.save_failed,
                success: this.save_succeeded,
                wait: true
            }
            this.model.save(data, options);
        },
        preprocess_data: function(data){
            return data;
        },
        delete_object: function(evt){
            var options = {
                error: this.delete_failed,
                wait: true
            }
            this.model.destroy(options)
        },
        save_succeeded: function(model, response, options){
            this.render({is_editing: false});
        },
        save_failed: function(model, response, options){
            alert("Couldn't save!");
        },
        delete_failed: function(model, response, options){
            alert("Couldn't delete!");
        },
        model_changed: function(model){
            this.render();
        },
        hide: function(evt){
            evt.preventDefault();
            this.trigger("hide_details", this);
        }
    });


    // An enhanced complex view whose subviews are meant to display
    // some items. Usually these will be members of a Backbone.Collection.
    // It also knows how to display an item's details view.
    Backbone.ListView = Backbone.ComplexView.extend({
        item_view: Backbone.ListItemView,
        item_details_view: Backbone.DetailsView ,
        item_details_elem_template: "<div></div>",
        events: {
            'click a[data-action="load_more"]': 'load_more'
        },
        initialize: function(){
            _.bindAll(
                this,
                'model_added',
                'model_changed',
                'model_removed',
                'model_destroyed',
                'show_item_details',
                'hide_item_details',
                'get_item_details_options',
                'insert_item_details_view',
                'bind_item_details_events',
                'unbind_item_details_events',
                'load_more'
            );
            Backbone.ComplexView.prototype.initialize.apply(this, arguments);
            this.item_details = null;
        },
        bind_events: function(){
            Backbone.ComplexView.prototype.bind_events.apply(this, arguments);
            if (this.collection) {
                this.collection.on('add', this.model_added);
                this.collection.on('change', this.model_changed);
                this.collection.on("remove", this.model_removed);
                this.collection.on("destroy", this.model_destroyed);
                this.collection.on('reset', this.remove_subviews);
            }
        },
        unbind_events: function(){
            Backbone.ComplexView.prototype.unbind_events.apply(this, arguments);
            if (this.collection) {
                this.collection.off('add', this.model_added);
                this.collection.off('change', this.model_changed);
                this.collection.off("remove", this.model_removed);
                this.collection.off("destroy", this.model_removed);
                this.collection.off('reset', this.remove_subviews);
            }
        },
        bind_subview_events: function(subview){
            Backbone.ComplexView.prototype.bind_subview_events.apply(this, arguments);
            subview.on("show_details", this.show_item_details);
        },
        unbind_subview_events: function(subview){
            Backbone.ComplexView.prototype.unbind_subview_events.apply(this, arguments);
            subview.off("show_details", this.show_item_details);
        },
        bind_item_details_events: function(){
            this.item_details.on("hide_details", this.hide_item_details);
        },
        unbind_item_details_events: function(){
            this.item_details.off("hide_details", this.hide_item_details);
        },
        get_items: function(){
            return this.collection ? this.collection.models : [];
        },
        get_subview_options: function(item){
            var options = {
                el: $(this.subview_elem_template)
            }
            var name = this.collection ? "model" : "item";
            options[name] = item;
            return options;
        },
        get_subview_identifier: function(subview){
            return subview.model ? subview.model.get("id") : subview.cid;
        },
        model_added: function(model){
            var subview_options = this.get_subview_options(model);
            this.render_subview(subview_options);
            if (this.collection && this.collection.has_more) {
                this.$('*[data-action="load_more"]').show();
            }else{
                this.$('*[data-action="load_more"]').hide();
            }
        },
        model_changed: function(model){
            this.subviews[model.get("id")].render(this.get_subview_render_options());
        },
        model_destroyed: function(model){
            this.collection.remove(model);
        },
        model_removed: function(model){
            var subview = this.subviews[model.get("id")];
            this.remove_subview(subview);
            if (this.item_details && this.item_details.model.get("id") == model.get("id")) {
                this.item_details.destroy();
                this.item_details.$el.remove();
            }
        },
        get_item_details_options: function(item){
            return {
                model: item,
                el: $(this.item_details_elem_template)
            }
        },
        show_item_details: function(subview){
            if (this.item_details) {
                this.hide_item_details();
            }
            subview.$el.addClass("active-subview");
            var item_details_options = this.get_item_details_options(subview.model);
            this.render_item_details(item_details_options);
            this.bind_item_details_events();
        },
        render_item_details: function(options){
            this.item_details = new this.item_details_view(options);
            this.insert_item_details_view(this.item_details);
            this.item_details.render();
        },
        insert_item_details_view: function(item_details_view){

        },
        hide_item_details: function(){
            if (!this.item_details) {
                return;
            }
            this.$(".active-subview").removeClass("active-subview");
            this.unbind_item_details_events();
            this.item_details.destroy();
            this.item_details.$el.remove();
        },
        load_more: function(evt){
            evt.preventDefault();
            var data = {exclude: this.collection.models.map(function(model){ return model.get("id"); })};
            this.collection.fetch({
                add: true,
                data: data,
                traditional: true
            });
        }
    });


    // A view intended for construction of subviews of a FilterView
    // defined below
    Backbone.FilterItemView = Backbone.View.extend({
        template: null,
        events: {
            "click a[data-action='filter']": "filter"
        },
        initialize: function(){
            _.bindAll(
                this,
                'destroy',
                'bind_events',
                'unbind_events',
                'render',
                'unrender',
                'get_template_context',
                'filter'
            );
            this.item = this.options.item;
            this.bind_events();
        },
        destroy: function(){
            this.unbind_events();
            this.undelegateEvents();
            this.unrender();
        },
        bind_events: function(){
            
        },
        unbind_events: function(){
            
        },
        unrender: function(){
            this.$el.empty();
        },
        render: function(){
            var template_context = this.get_template_context();
            var compiledTemplate = _.template(this.template, template_context);
            this.$el.html(compiledTemplate);
        },
        get_template_context: function(){
            var context = {
                filter_val: this.model ? this.model.get("id") : this.item.id,
                filter_name: this.model ? this.model.get("name") : this.item.name
            };
            return context;
        },
        filter: function(evt){
            evt.preventDefault();
            var $curr_target = $(evt.currentTarget);
            var filter_value = $curr_target.data("value");
            var filter_value_name = $curr_target.html();
            this.trigger("filter_chosen", this, filter_value, filter_value_name);
        }
    });


    // A ListView that knows how to filter a given collection
    Backbone.FilterView = Backbone.ListView.extend({
        template: null,
        item_view: Backbone.FilterItemView,
        subview_elem_template: "<li class='list-item'></li>",
        filter_by: null,
        events: {
            "click a[data-action='reset_filter']": "reset_filter",
        },
        initialize: function(){
            _.bindAll(
                this,
                'on_item_filter',
                'filter',
                'reset_filter',
                'mark_chosen_filter'
            );
            Backbone.ListView.prototype.initialize.call(this, arguments);

            this.filter_by = this.options.filter_by || this.filter_by;
            this.filtered_collection = this.options.filtered_collection;
            this.is_filtering = false;
        },
        bind_subview_events: function(subview){
            subview.on("filter_chosen", this.on_item_filter);
        },
        unbind_subview_events: function(subview){
            subview.off("filter_chosen", this.on_item_filter);
        },
        insert_subview: function(subview){
            var $after = this.$("li.list-item").length ? this.$("li.list-item:last") : this.$(".items-divider");
            $after.after(subview.$el);
        },
        mark_chosen_filter: function(filter_value){
            if (!filter_value){
                this.$(".chosen-filter").html(this.$("a[data-action='reset_filter']").html());
            }else{
                this.$(".chosen-filter").html(this.$("a[data-value='"+filter_value+"']").html());
            }
        },
        filter: function(filter_value, filter_value_name){
            var filters = {};
            filters[this.filter_by] = filter_value;
            this.filtered_collection.apply_filters(filters);
            this.is_filtering = true;
            this.mark_chosen_filter(filter_value);
        },
        on_item_filter: function(subview, filter_value, filter_value_name){
            this.filter(filter_value, filter_value_name);
        },
        reset_filter: function(){
            if (!this.is_filtering) {
                return false;
            }
            var filter_value_name = this.$("*[data-action='reset_filter']").html();
            this.filter(null, filter_value_name);
            this.is_filtering = false;
            this.filtered_collection.trigger('filter_unset', this.filter_by);
            return true;
        },
        model_destroyed: function(model){
            Backbone.ListView.prototype.model_destroyed.apply(this, arguments);
            if (this.filtered_collection.filters && this.filtered_collection.filters[this.filter_by] ==  model.get("id")) {
                this.reset_filter();
            }
        },
        render: function(){
            Backbone.ListView.prototype.render.apply(this, arguments);
            var initial_value = this.filtered_collection.filters[this.filter_by];
            this.mark_chosen_filter(initial_value);
            if (initial_value) {
                this.is_filtering = true;
            }
        }
    });


    // A list view that makes it easier to add models to a collection.
    Backbone.ManagerView = Backbone.ListView.extend({
        subview_elem_template : "<div class='control-group'></div>",
        events: {
            'click a[data-action="add_line"]': 'add_subview'
        },
        initialize: function(){
            _.bindAll(
                this,
                'subview_added_model'
            );
            Backbone.ListView.prototype.initialize.call(this, arguments);
        },
        bind_subview_events: function(subview){
            Backbone.ListView.prototype.bind_subview_events.call(this, subview);
            subview.on("created_model", this.subview_added_model);
            subview.on("remove_empty_line_clicked", this.remove_subview);
        },
        unbind_subview_events: function(subview){
            Backbone.ListView.prototype.unbind_subview_events.call(this, subview);
            subview.off("remove_empty_line_clicked", this.remove_subview);
            subview.off("created_model", self.subview_added_model);
        },
        insert_subview: function(subview){
            this.$("div.control-group:last").before(subview.$el);
        },
        get_subview_render_options: function(){
            return {
                is_editing: true
            }
        },
        subview_added_model: function(subview, model){
            this.subviews[model.get("id")] = subview;
            delete this.subviews[subview.cid];
            this.collection.add([model]);
        },
        model_added: function(model){
            // This is ugly, but in our case subview_added_model does all the work.
            if (this.subviews[model.get("id")]){
                return;
            }
            Backbone.ListView.prototype.model_added.call(this, model);
        }
    });


    // An auxilliary view for displaying a manager view in a bootstrap modal
    Backbone.ManagerModalView = Backbone.ManagerView.extend({
        render: function(){
            Backbone.ManagerView.prototype.render.call(this, arguments);
            this.$modal = this.$(".modal");
            this.$modal.modal({show: false});
        },
        show: function(){
            this.$modal.modal('show');
        },
        hide: function(){
            this.$modal.modal('hide');  
        }

    });


    // An auxilliary view for diplaying a manager modal view
    Backbone.ManagerModalHandlerView = Backbone.View.extend({
        template: null,
        modal: null,
        modal_placeholder: $('<div></div>'),
        events: {
            'click *[data-action="manage_items"]': 'manage_items'
        },
        initialize: function(){
            _.bindAll(
                this,
                'destroy',
                'render',
                'unrender',
                'bind_events',
                'unbind_events',
                'manage_items'
            );
        },
        destroy: function(){
            this.unbind_events();
            this.unrender();
        },
        bind_events: function(){

        },
        unbind_events: function(){

        },
        unrender: function(){
            this.$el.empty();
        },
        render: function(){
            var self = this;
            var compiledTemplate = _.template(self.template);
            self.$el.html(compiledTemplate);

            var $modal_el = this.modal_placeholder;
            $('body').append($modal_el);

            self.manage_collection_modal = new this.modal({
                el: $modal_el,
                collection: self.collection
            });
            self.manage_collection_modal.render();

            return self;
        },
        manage_items: function(){
            this.manage_collection_modal.show();
        }
    });
})(jQuery, _, Backbone);
