var ExpenseCompleter = Class.create();

/**
 * Custom autocompleter for Expense
 * -- NEW IMPROVED VERSION OF DicodeAutoComplete
 * @author Anton Netterwall
 * @copyright Dicom Expense AB
 */
ExpenseCompleter.prototype = {
	/**
	 * Constructor
	 * @param {string} inputElementID Element to autocomplete
	 * @param {object} settings
	 * @returns {undefined}
	 */
	initialize: function(inputElementID) {
		// Private variables
		this.container = new Element('ul');
		this.currentRequest = null;
		this.inputElement = $(inputElementID);
		this.itemCount = 0;
		this.itemList = '';
		this.requestTimeout = null;

		// Settings
		this.settings = Object.extend({
			// Should requests be sent if the inputElement is empty
			allowEmptyRequests: true,
			// Should user be allowed to store any data in the value
			allowFreeInput: true,
			// Duration of fadeIn animation of autocomplete (seconds)
			appearDuration: 0.2,
			// Class of autocomplete container
			containerClass: 'autocomplete-container',
			// ID of autocomplete container
			containerID: this.inputElement.readAttribute('id') + 'Completer',
			// Delay before starting fade animation (milliseconds)
			fadeDelay: 100,
			// Duration of fadeOut animation of autocomplete (seconds)
			fadeDuration: 0.1,
			// Run when field is left without value
			onEndWithoutValue: function() {},
			// Function run when value is selected (return true to activate)
			onSetValue: function() { return false; },
			// Should user be alerted of underlying errors
			reportErrors: false,
			// Delay before sending request after key press (milliseconds)
			requestDelay: 200,
			// Encoding of sent request
			requestEncoding: 'ISO-8859-1',
			// Url to contact
			requestUrl: null,
			// Param to add to request with search string
			requestSearchParamName: 'q',
			// Class for each result item
			resultItemClass: 'autocomplete-result-item',
			// Class for selected result item
			resultItemSelectedClass: 'selected',
			// Selected item in list
			selectedItem: -1,
			// Should autocomplete be shown on focus
			shouldCompleteOnFocus: true,
			// Element to set value in
			valueElement: $(this.inputElement.readAttribute('id') + 'Value')
		}, arguments[1] || {});
		
		this.container.writeAttribute('id', this.settings.containerID);
		this.container.addClassName(this.settings.containerClass);
		this.container.setStyle({
			minWidth: this.getMinWidth() + 'px'
		});

		// Add event listeners
		this.addListeners();
		
		// Update position
		this.updatePosition();
		
		// Update max height
		this.updateMaxHeight();
	},
	/**
	 * Add event listeners
	 * @returns {undefined}
	 */
	addListeners: function() {
		var parentThis = this;

		parentThis.inputElement.observe('focus', function(event) {
			if (parentThis.settings.shouldCompleteOnFocus)
				parentThis.sendRequest();
		});
		
		parentThis.inputElement.observe('blur', function(event) {
			parentThis.disable();
			
			if (parentThis.settings.valueElement.value.trim() === '')
				parentThis.settings.onEndWithoutValue(parentThis.inputElement.value);
		});

		parentThis.inputElement.observe('keydown', function(event) {
			parentThis.navigateAutoComplete(event);
		});

		parentThis.inputElement.observe('keyup', function(event) {
			if (!parentThis.eventIsNavigationKeyStroke(event))
				parentThis.sendRequest();
		});
		
		$$("div").each(function (element) {
            element.observe("scroll", function () {
                parentThis.updatePosition();
				parentThis.updateMaxHeight();
            });
        });
		
		Event.observe(window, "resize", function() {
			parentThis.updateMaxHeight();
		});
	},
	/**
	 * Check if event is a valid keystroke for navigation in autocompleter
	 * @param {Event} event
	 * @returns {Boolean}
	 */
	eventIsNavigationKeyStroke: function(event) {
		return event.keyCode === Event.KEY_RETURN || event.keyCode === Event.KEY_TAB || event.keyCode === Event.KEY_UP || event.keyCode === Event.KEY_DOWN;
	},
	/**
	 * Update autocomplete position
	 * @returns {undefined}
	 */
	updatePosition: function() {
		var parentThis = this;
		
		parentThis.container.setStyle({
			'left': parentThis.getLeftPosition() + 'px',
			'top': parentThis.getTopPosition() + 'px'
		});
	},
	/**
	 * Update max height of auto completer
	 * @returns {undefined}
	 */
	updateMaxHeight: function() {
		var parentThis = this;
		
		parentThis.container.setStyle({
			maxHeight: this.getMaxHeight() + 'px',
			'_height': this.getMaxHeight() + 'px'
		});
	},
	/**
	 * Get autocompleter left position
	 * @returns {int}
	 */
	getLeftPosition: function() {
		var parentThis = this;
		
		return parentThis.inputElement.cumulativeOffset()[0];
	},
	/**
	 * Get autocompleter top position
	 * @returns {int}
	 */
	getTopPosition: function() {
		var parentThis = this;
		
		return parentThis.inputElement.cumulativeOffset()[1] + parentThis.inputElement.getHeight() - parentThis.getScrollOffset();
	},
	/**
	 * Get scroll offset on the element
	 * @returns {int}
	 */
	getScrollOffset: function() {
		var parentThis = this;
		
		return parentThis.inputElement.cumulativeScrollOffset()[1];
	},
	/**
	 * Get autocompleter inner scroll offset for specific item
	 * @returns {int}
	 */
	getInnerScrollOffsetForItem: function(item) {
		var parentThis = this;
		
		return Element.cumulativeOffset(item)[1] - parentThis.getTopPosition();
	},
	/**
	 * Get min width for autocompleter based on input width
	 * @returns {int}
	 */
	getMinWidth: function() {
		var parentThis = this;
		
		return parentThis.inputElement.getWidth();
	},
	/**
	 * Get max possible height on current window
	 * @returns {int}
	 */
	getMaxHeight : function () {
		var parentThis = this;
		
		return document.viewport.getDimensions().height - (parentThis.getTopPosition() + parentThis.inputElement.getHeight());
	},
	/**
	 * Get autocomplete container using ID selector rather than the internal pointer
	 * @returns {Element}
	 */
	getActiveContainer: function() {
		var parentThis = this;
		
		return $(parentThis.settings.containerID);
	},
	/**
	 * Get an enumerable array of result items
	 * @returns {Array[element]}
	 */
	getAllResultItems: function() {
		var parentThis = this;
		
		return $$('#' + parentThis.settings.containerID + ' .' + parentThis.settings.resultItemClass);
	},
	/**
	 * Get query string
	 * @returns {String}
	 */
	getQueryString: function() {
		var parentThis = this;
		
		return parentThis.settings.requestUrl + (parentThis.settings.requestUrl.indexOf('?') !== -1 ? '&' : '?') + parentThis.settings.requestSearchParamName + '=' + parentThis.inputElement.value;
	},
	/**
	 * Send request to server and handle response
	 * @returns {undefined}
	 */
	sendRequest: function() {
		var parentThis = this;

		// Reset previous requests
		parentThis.abortCurrentRequest();
		parentThis.clearRequestTimeout();
		
		parentThis.requestTimeout = setTimeout(function() {
			parentThis.currentRequest = new Ajax.Request(parentThis.getQueryString(), {
				onSuccess: function(response) {
					if (response.status > 299 && parentThis.settings.reportErrors) {
						alert("Ett fel har inträffat: " + response.responseText);
					} else if (response.responseJSON === null || response.responseJSON.success === true) {
						parentThis.handleResponse(response);
					} else if (parentThis.settings.reportErrors) {
						alert("Ett ajaxfel har inträffat: " + response.responseJSON.error);
					}

					if (Ajax.activeRequestCount < 0) {
						Ajax.activeRequestCount = 0;
					}
				},
				encoding: parentThis.settings.requestEncoding
			});
		}, parentThis.settings.requestDelay);
	},
	/**
	 * Delegate the serverResponse to correct handler
	 * @param {ResponseObject} response
	 * @returns {undefined}
	 */
	handleResponse: function(response) {
		var parentThis = this;
		
		// Reset variables
		parentThis.itemCount = 0;
		parentThis.itemList = '';
		
		// Handle as JSON
		if (response.getHeader('Content-type').match(/json/i))
			parentThis.handleJsonResponse(response.responseJSON);
		
		// Handle as HTML
		else
			parentThis.handleHtmlResponse(response.responseText);
		
		// Autcomplete
		parentThis.enable();
	},
	/**
	 * Handle html type response from the request
	 * @param {string} htmlResponse
	 * @returns {undefined}
	 */
	handleHtmlResponse: function(htmlResponse) {
		var parentThis = this;
		
		parentThis.itemList = htmlResponse;
		parentThis.itemCount = htmlResponse.match(/\<li/g).length;
	},
	/**
	 * Handle json type response from the request
	 * @param {JSON} jsonResponse
	 * @returns {undefined}
	 */
	handleJsonResponse: function(jsonResponse) {
		var parentThis = this;
		
		jsonResponse.list.each(function(item, index) {
			var selectedClass = index === parentThis.selectedItem ? ' ' + parentThis.settings.resultItemSelectedClass : '';
			
			item.name = item.name !== undefined ? item.name : '';
			item.value = item.value !== undefined ? item.value : '';
			item.caption = item.caption !== undefined ? item.caption : item.name;
			item.title = item.title !== undefined ? item.title : item.name;
			
			parentThis.itemList += '<li data-name="' + item.name + '" data-value="' + item.value + '" title="' + item.title + '" class="' + parentThis.settings.resultItemClass + selectedClass + '">';
			parentThis.itemList += item.caption;
			parentThis.itemList += '</li>';
			
			parentThis.itemCount++;
		});
	},
	/**
	 * Should autocompleter be shown
	 * @returns {Boolean}
	 */
	shouldAutoComplete: function() {
		var parentThis = this;
		
		return parentThis.itemCount > 0;
	},
	/**
	 * Navigate the autocompleter using events
	 * @param {Event} event
	 * @returns {undefined}
	 */
	navigateAutoComplete: function(event) {
		var parentThis = this;
		
		if (parentThis.eventIsNavigationKeyStroke(event) && parentThis.getActiveContainer() != undefined) {
			// Down arrow
			if (event.keyCode === Event.KEY_DOWN) {
				var selectedItem = parentThis.settings.selectedItem + 1;
				if (selectedItem < parentThis.itemCount)
					parentThis.settings.selectedItem = selectedItem;
				else
					parentThis.settings.selectedItem = 0;
				
				parentThis.getAllResultItems().each(function(item, index) {
					if (index === parentThis.settings.selectedItem) {
						// Scroll to correct position on navigation
						var topOffset = parentThis.getInnerScrollOffsetForItem(item);
						if (topOffset > parentThis.getActiveContainer().getHeight() - item.getHeight()) // 30 extra för att börja skrolla även på ett val som ligger halvvägs mellan att synas och inte
							parentThis.getActiveContainer().scrollTop = topOffset;
						else if (topOffset === 0)
							parentThis.getActiveContainer().scrollTop = 0;
					
						item.addClassName(parentThis.settings.resultItemSelectedClass);
					} else {
						item.removeClassName(parentThis.settings.resultItemSelectedClass);
					}
				});
				
			// Up arrow
			} else if (event.keyCode === Event.KEY_UP) {
				var selectedItem = parentThis.settings.selectedItem - 1;
                if (selectedItem >= 0)
					parentThis.settings.selectedItem = selectedItem;
                else
					parentThis.settings.selectedItem = parentThis.itemCount - 1;
				
				parentThis.getAllResultItems().each(function(item, index) {
					if (index === parentThis.settings.selectedItem) {
						// Scroll to correct position on navigation
						var topOffset = parentThis.getInnerScrollOffsetForItem(item);
						if (topOffset < parentThis.getActiveContainer().scrollTop)
							parentThis.getActiveContainer().scrollTop = topOffset;
						else if (topOffset > parentThis.getActiveContainer().scrollTop)
							parentThis.getActiveContainer().scrollTop = topOffset;
						
						item.addClassName(parentThis.settings.resultItemSelectedClass);
					} else {
						item.removeClassName(parentThis.settings.resultItemSelectedClass);
					}
				});
				
			// Enter OR Tab key
			} else if (event.keyCode === Event.KEY_RETURN || event.keyCode === Event.KEY_TAB) {
				if (parentThis.getActiveContainer() == undefined)
					return;
				
				var selectedItem = parentThis.getActiveContainer().down('.' + parentThis.settings.resultItemClass + '.' + parentThis.settings.resultItemSelectedClass);
				if (selectedItem != undefined) {
					parentThis.setValue(selectedItem);
				} else {
					// Store free text into value if allowed
					parentThis.setValue(parentThis.inputElement.value);
					parentThis.disable();
				}
			}
		}
	},
	setValue: function(resultItem) {
		var parentThis = this;
		
		// Free text input
		if (typeof resultItem === 'string') {
			if (parentThis.settings.allowFreeInput)
				parentThis.settings.valueElement.value = resultItem;
		
		// If no custom value setter is registered - run predefined
		} else if (!parentThis.settings.onSetValue(resultItem, parentThis.inputElement)) {
			var value = resultItem.readAttribute('data-value');
			var name = resultItem.readAttribute('data-name');
			
			parentThis.inputElement.value = name;
			parentThis.settings.valueElement.value = value;
		}
		
		parentThis.settings.valueElement.simulate('change');
	},
	/**
	 * Show autocomplete
	 * @returns {undefined}
	 */
	enable: function() {
		var parentThis = this;
		
		if (parentThis.shouldAutoComplete()) {
			var autoCompleteContainer = $(parentThis.settings.containerID);
			
			if (autoCompleteContainer != undefined) {
				autoCompleteContainer.update(parentThis.itemList);
			}
			else {
				parentThis.container.update(parentThis.itemList);
				$$("body")[0].insert(parentThis.container);
				parentThis.container.appear({
					duration: parentThis.settings.appearDuration
				});
			}

			parentThis.getAllResultItems().each(function(item, index) {
				if (index === parentThis.settings.selectedItem)
					item.addClassName(parentThis.settings.resultItemSelectedClass);

				item.observe('mousedown', function() {
					parentThis.setValue(this);
				});
			});
		} else {
			parentThis.disable();
		}
	},
	/**
	 * Hide autocomplete and disable
	 * @returns {undefined}
	 */
	disable: function() {
		var parentThis = this;
		
		parentThis.abortCurrentRequest();
		parentThis.clearRequestTimeout();
		
		var autoCompleteContainer = $(parentThis.settings.containerID);
		if (autoCompleteContainer != undefined) {
			setTimeout(function() {
				autoCompleteContainer.fade({
					duration: parentThis.settings.fadeDuration,
					afterFinish: function() {
						if (autoCompleteContainer != undefined)
							autoCompleteContainer.remove();
					}
				});
			}, parentThis.settings.fadeDelay);
		}
	},
	/**
	 * Clear current pending request timeout
	 * @returns {undefined}
	 */
	clearRequestTimeout: function() {
		var parentThis = this;
		
		if (parentThis.requestTimeout)
			clearTimeout(parentThis.requestTimeout);
	},
	/**
	 * Abort current request
	 * @returns {undefined}
	 */
	abortCurrentRequest: function() {
		var parentThis = this;

		if (parentThis.currentRequest !== null)
			parentThis.currentRequest.abort();
	}
};

Ajax.Request.prototype.abort = function() {
	this.transport.onreadystatechange = Prototype.emptyFunction;
	this.transport.abort();
	Ajax.activeRequestCount--;
};