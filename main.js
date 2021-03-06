/*
 container - селектор/dom-элемент/jQuery, будет использован первый элемент из выборки
 nodeStyles - массив стилей узлов (https://visjs.github.io/vis-network/docs/network/nodes.html)
 edgeStyles - массив стилей рёбер (https://visjs.github.io/vis-network/docs/network/edges.html)
 */
function GraphEditor(container, nodeStyles, titles = ['Новый узел'], edgeStyles, nodesData, edgesData) {
//TODO: сделать, чтобы изменение graph.types[class] автоматически применяли (переконструировались меню редакторов)
	function AssertVariable(path, owner, library) {
		owner = owner || window;
		let variable;
		let names = path.split('.');
		library = library || names[0];
		names.forEach(name => {
			variable = owner[name];
			if (typeof (variable) === 'undefined') throw `Graph editor error: ${library} library must be included.`;
			owner = variable;
		});
	}

	AssertVariable('jQuery');
	AssertVariable('vis.Network', false, 'Vis.js Network');
	AssertVariable('vis.DataSet', false, 'Vis.js DataSet');
	AssertVariable('transition', jQuery(), 'Semantic UI');
	AssertVariable('modal', jQuery(), 'Semantic UI');
	AssertVariable('dropdown', jQuery(), 'Semantic UI');

	let scope = {
		classes: Object.freeze({node: 'Узел', edge: 'Ребро'}),
		container: jQuery(container).first(),
		save: () => Download(scope.serialize(), 'graph.json', 'application/json'),
		addNode: (id, type = 0, template = {}) => {
			scope.graph.storePositions();
			let pos = {x: 0, y: 0};
			let nodes = scope.data[scope.classes.node].get();
			console.log('type', type);
			if (nodes.length) {
				pos.x = nodes.map(n => n.x).reduce((a, b) => a + b) / nodes.length;
				pos.y = nodes.map(n => n.y).reduce((a, b) => a + b) / nodes.length;
				pos.x += Math.random() * 100 - 50;
				pos.y += Math.random() * 100 - 50;
			}
			setTimeout(() => StabilizeFitZoom(), 1);
			return scope.data[scope.classes.node].add(Object.assign({}, pos, scope.types[scope.classes.node][type].template, {id: id, type: type}, template))[0];
		},
		addEdge: (from, to, id, type = 0, template = {}) => {
			return scope.data[scope.classes.edge].add(Object.assign({}, scope.types[scope.classes.edge][type].template, {id: id, type: type, from: from, to: to}, template))[0];
		},
		removeNode: id => scope.data[scope.classes.node].remove(id),
		removeEdge: id => scope.data[scope.classes.edge].remove(id),
	};
	scope.data = {
		[scope.classes.node]: new vis.DataSet(nodesData),
		[scope.classes.edge]: new vis.DataSet(edgesData),
	};
	scope.types = {
		[scope.classes.node]: nodeStyles && nodeStyles.length ? nodeStyles : GraphEditor.CreateStyles(
			GraphEditor.CreateType('Эллипс', 'Синие эллипсы', 'blue', {
				color: '#8dd0f8',
				shape: 'ellipse'
			}),
			GraphEditor.CreateType('Прямоугольник', 'Зелёные прямоугольники', 'green', {
				color: '#82ec93',
				shape: 'box'
			})
		),
		[scope.classes.edge]: edgeStyles && edgeStyles.length ? edgeStyles : GraphEditor.CreateStyles(
			GraphEditor.CreateType('Сплошное', 'Без штриховки', 'hidden', {
				arrows: 'to',
				dashes: false,
				color: {inherit: 'both'}
			}),
			GraphEditor.CreateType('Штрихованное', 'Равномерная штриховка', 'hidden', {
				arrows: 'to',
				dashes: true,
				color: {inherit: 'both'}
			})
		),
	};

	if (!scope.container.length) throw 'Graph editor error: can not find container.';

	/*
	 Build functions: (data)->jQuery. Build markup and attach events.
	 Всего необходимо собрать 4 элемента:
	 - окно открытия графа
	 - граф
	 - меню
	 - редакторы
	 */

	/*
	 startEditingCallback (class, editing graph element) - начало редактирования
	 endEditingCallback (class, editing graph element) -> corrected graph element - конец редактирования
	 */
	function BuildGraph(startEditingCallback, endEditingCallback) {
		let $graph = jQuery('<div class="pane"></div>');
		let edgeEditorState = 0;
		let editedElement, editedClass;
		scope.graph = new vis.Network($graph[0],
			{
				nodes: scope.data[scope.classes.node],
				edges: scope.data[scope.classes.edge]
			},
			{
				manipulation: {
					enabled: false,
					editEdge: function (edgeData, callback) {
						if (edgeData.from === edgeData.to) callback(null);
						else {
							setTimeout(() => {
								scope.graph.disableEditMode();
							}, 1);
							edgeEditorState = 0;
							callback(endEditingCallback(scope.classes.edge, edgeData));
						}
					},
					addNode: function (nodeData, callback) {
						nodeData.type = '0';
						delete nodeData.label;
						setTimeout(() => {
							scope.graph.disableEditMode();
							//jQuery('#addNode').removeClass('active');
						}, 1);
						callback(endEditingCallback(scope.classes.node, nodeData));
					},
					addEdge: function (edgeData, callback) {
						edgeData.type = '0';
						delete edgeData.label;
						delete edgeData.title;
						setTimeout(() => {
							scope.graph.disableEditMode();
							//jQuery('#addEdge').removeClass('active');
						}, 1);
						if (edgeData.from !== edgeData.to) callback(endEditingCallback(scope.classes.edge, edgeData));
					}
				},
				locale: 'ru',
				physics: {
					stabilization: {
						fit: false
					}
				}
			});
		scope.graph.addEventListener('select', function (e) {
			if (e.nodes.length) {
				editedElement = scope.data[scope.classes.node].get(e.nodes[0]);
				editedClass = scope.classes.node;
				startEditingCallback(editedClass, editedElement);
			} else if (e.edges.length === 1) {
				scope.graph.editEdgeMode();
				editedElement = scope.data[scope.classes.edge].get(e.edges[0]);
				editedClass = scope.classes.edge;
				edgeEditorState = 1;
				startEditingCallback(editedClass, editedElement);
			} else if (editedElement && editedClass) endEditingCallback(editedClass, editedElement);
		});
		$graph.find('canvas').click(function () {
			if (edgeEditorState === 1)
				edgeEditorState = 2;
			else if (edgeEditorState === 2) {
				edgeEditorState = 0;
				scope.graph.disableEditMode();
				scope.graph.unselectAll();
			}
		});
		scope.serialize = function () {
			scope.graph.storePositions();
			// noinspection JSCheckFunctionSignatures
			return JSON.stringify(Object.fromEntries(Object.entries(scope.classes).map(([className, classValue]) => [className, scope.data[classValue].get()])));
		};
		scope.deserialize = function (json) {
			let buf = JSON.parse(json);
			// noinspection JSCheckFunctionSignatures
			Object.entries(scope.classes).forEach(([className, classValue]) => {
				scope.data[classValue].clear();
				buf[className].forEach(x => scope.data[classValue].add(x));
			});
			StabilizeFitZoom();
		};
		return $graph;
	}

	// loadCallback приинмает загруженные данные. При ошибке должна выбросить исключение.
	function BuildModal(loadCallback) {
		let $modal = jQuery(`<div class="ui mini modal">
				<div class="header">Загрузить граф из файла</div>
				<div class="content">
					<div class="file ui left labeled button">
						<a class="ui basic label">
							Файл не выбран
						</a>
						<div class="ui icon button">
							<i class="file code icon"></i>
							Выбрать файл
						</div>
					</div>
					<input type="file" autocomplete="off" accept="application/json" hidden>
					<div class="ui hidden negative message">
						<p>Невозможно загрузить файл. Проверьте правильность пути, формат или укажите другой файл.</p>
					</div>
				</div>
				<div class="actions">
					<div class="ui negative cancel button">Отмена</div>
					<div class="ui positive ok button">Загрузить</div>
				</div>
			</div>`);

		function ToggleError(hide) {
			if (!hide && hide === $error.is(':visible')) $error.transition('fade up');
			if (hide) $approve.addClass('loading');
			else $approve.removeClass('loading');
		}

		let currentFile;
		let $input = $modal.find('input[type="file"]');
		let $label = $modal.find('.content .file.button .label');
		let $error = $modal.find('.negative.message');
		let $approve = $modal.find('.actions .ok.button');
		$modal.find('.content .file.button').click(() => $input.trigger('click'));
		$input.change(function () {
			currentFile = this.files && this.files[0] ? this.files[0] : false;
			$label.text(currentFile && currentFile.name || 'Выбрать файл');
		});
		$modal.initialize = function () {
			$modal.modal({
				transition: 'horizontal flip',
				blurring: true,
				onApprove: function () {
					if (!currentFile) ToggleError(false);
					else {
						ToggleError(true);
						let reader = new FileReader();
						reader.onerror = reader.onabort = () => ToggleError(false);
						reader.onload = function (e) {
							try {
								loadCallback(e.target.result);
								$approve.removeClass('loading');
								$modal.modal('hide');
							} catch (e) {
								ToggleError(false);
							}
						};
						reader.readAsText(currentFile);
					}
					return false;
				},
			});
		};
		$modal.show = () => $modal.modal('show');
		return $modal;
	}

	/*
	 item = {
	 name: data-name_attribute,
	 label: displayed_text,
	 icon: semantic_ui (https://semantic-ui.com/elements/icon without 'icon'),
	 click: jquery_callback
	 }
	 */
	function BuildMenu(...items) {
		let $items = items.map(item => jQuery(`<a class="item" data-name="${item.name}">
									<i class="${item.icon} icon"></i>
									${item.label}
								</a>`)
			.click(item.click));
		let $menu = jQuery(`<div class="graph-menu">
						<div class="ui compact labeled icon raised menu">		
						</div>
					</div>`);
		$menu.find('.menu').append(...$items);
		return $menu;
	}

	/*
	 returns editor jQuery with load function (graph editing object) -> editor jQuery
	 saveCallback = function (class, graph edited object)
	 deleteCallback = function (class, graph editing object)
	 */
	function BuildEditor(elementClass, saveCallback, deleteCallback) {
		let buf = scope.types[elementClass].map(t => `<div class="item" data-value="${t.id}" data-text='
														<div class="ui ${t.color} empty circular label"></div> ${t.name}
													'>
														<div class="ui ${t.color} empty circular label"></div> ${t.name} 
														<span class="description">${t.description}</span>
													</div>`);
		let labelBuf;
		if (elementClass === scope.classes.edge) labelBuf = '<div class="label-text" contenteditable="true" data-placeholder="Введите название">Название</div>'; else {
			let tbuf = titles.map(t => `<div class="item" data-value="${t}" data-text='${t}'>${t}</span></div>`);
			labelBuf = `<div class="ui search selection dropdown"><input type="hidden" value="0" data-property="title">
								<i class="dropdown icon"></i>
								<div class="label-text text">Название</div>								
								<div class="menu">${tbuf.join('')}</div>
							</div>`;
		}
		let $editor = jQuery(`<div class="class-editor">
				<div class="ui raised card">
					<div class="content">
						<div class="label">${labelBuf}</div>
						<div class="meta">${elementClass}</div>
						<div class="description"><p contenteditable="true" data-placeholder="Введите описание">Описание</p>
							<div class="ui inline labeled dropdown"><input type="hidden" value="0" data-property="type">
								<div class="text">${jQuery(buf[0]).find('.item').data('text')}</div>
								<i class="dropdown icon"></i>
								<div class="menu">${buf.join('')}</div>
							</div>
						</div>
					</div>
					<div class="ui bottom attached buttons">
						<button class="delete ui grey button">Удалить</button>
						<div class="or" data-text="?"></div>
						<button class="save ui positive button">Сохранить</button>
					</div>
				</div>
			</div>`);
		let $label = $editor.find('.content>.label .label-text');
		$editor.find('.content>.label .dropdown').dropdown();
		let $title = $editor.find('.content p[contenteditable="true"]');
		let $type = $editor.find('.content>.description .dropdown').dropdown();
		$editor.load = function (graphObject) {
			$editor.object = graphObject;
			$label.text(graphObject.label || '');
			$title.text(graphObject.title || '');
			$type.dropdown('set exactly', '' + (graphObject.type || '0'));
			$editor.transition($editor.is(":visible") ? 'jiggle' : 'fade right');
			return $editor;
		};
		$editor.hide = function () {
			if ($editor.is(":visible"))
				$editor.transition('fade right');
		};
		$editor.find('.save.button').click(function () {
			SetOrDelete($editor.object, 'label', $label.text().trim());
			SetOrDelete($editor.object, 'title', $title.text());
			$editor.object.type = $type.dropdown('get value')[0];
			$editor.hide();
			saveCallback(elementClass, $editor.object);
		});
		$editor.find('.delete.button').click(function () {
			$editor.hide();
			deleteCallback(elementClass, $editor.object);
		});
		return $editor;
	}

	function SetOrDelete(object, property, value) {
		if (!value && object.hasOwnProperty(property)) delete object[property];
		else object[property] = value;
		return object;
	}

	function Update(elementClass, element, save) {
		scope.graph.storePositions();
		let pos = scope.data[elementClass].get(element.id);
		element = Object.assign(element, scope.types[elementClass][element.type * 1].template, pos && pos.hasOwnProperty('x') ? {x: pos.x, y: pos.y} : {});
		if (save) {
			scope.data[elementClass].remove(element.id);
			scope.data[elementClass].add(element);
		}
		return element;
	}

	function StabilizeFitZoom() {
		scope.graph.stabilize();
		FitZoom();
	}

	function FitZoom() {
		scope.graph.storePositions();
		let nodes = scope.data[scope.classes.node].get();
		let x, y;
		if (!nodes.length) x = y = 0;
		else {
			x = nodes.map(n => n.x).reduce((a, b) => a + b) / nodes.length;
			y = nodes.map(n => n.y).reduce((a, b) => a + b) / nodes.length;
		}
		scope.graph.moveTo({
			position: {x: x, y: y},
			scale: 2,
			animation: true
		});
	}

	function Download(content, fileName, contentType) {
		let a = document.createElement("a");
		let file = new Blob([content], {type: contentType});
		a.href = URL.createObjectURL(file);
		a.download = fileName;
		a.click();
		//TODO: remove this <a>
	}

	function HideEditors(exclude) {
		Object.getOwnPropertyNames(editors).filter(classValue => classValue !== exclude).forEach(classValue => editors[classValue].hide());
	}

	// noinspection JSCheckFunctionSignatures
	let editors = Object.fromEntries(Object.values(scope.classes).map(classValue => [classValue,
		BuildEditor(classValue, function (elementClass, element) {
			scope.graph.disableEditMode();
			Update(elementClass, element, true);
		}, function (elementClass, element) {
			scope.graph.disableEditMode();
			scope.data[elementClass].remove(element.id);
		})]));
	let $graph = BuildGraph(function (elementClass, element) {
		HideEditors(elementClass);
		editors[elementClass].load(element);
	}, function (elementClass, element) {
		HideEditors();
		return Update(elementClass, element, false);
	});
	let $modal = BuildModal(scope.deserialize);
	scope.load = () => $modal.show();
	let $menu = BuildMenu({
		name: 'addNode',
		label: 'Новый узел',
		icon: 'plus square',
		click: function () {
			HideEditors();
			scope.graph.addNodeMode();
		}
	}, {
		name: 'addEdge',
		label: 'Новое ребро',
		icon: 'long arrow alternate right',
		click: function () {
			HideEditors();
			scope.graph.addEdgeMode();
		}
	}, {
		name: 'fitZoom',
		label: 'Выровнять',
		icon: 'expand',
		click: FitZoom
	}, {
		name: 'save',
		label: 'Сохранить',
		icon: 'save',
		click: scope.save
	}, {
		name: 'load',
		label: 'Загрузить',
		icon: 'folder open',
		click: scope.load
	});
	scope.container.html(jQuery('<div class="graph-editor"></div>').append($graph, $modal, $menu, ...Object.values(editors)));
	$modal.initialize();
	FitZoom();
	return scope;
}

GraphEditor.CreateType = function (name, description, color, template) {
	return {
		template: template,
		name: name,
		color: color,
		description: description
	};
};
GraphEditor.CreateStyles = function (...types) {
	return types.map(function (x, i) {
		x.template.type = x.id = '' + i;
		return x;
	});
};



