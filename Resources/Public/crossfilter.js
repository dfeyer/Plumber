// Various formatters.
var formatNumber = d3.format(",d");

// Create the crossfilter for the relevant dimensions and groups.
var profileCrossfilter = crossfilter(window.profileData),
	all = profileCrossfilter.groupAll();

var charts = [], chart, list;

var startTimeDimension = profileCrossfilter.dimension(function(d) {return d.startTime});

/*for (var optionName in window.options) {
	var optionDomain = [];
	for (var i in window.options[optionName]) {
		optionDomain.push(i);
	}
	var crossfilterOptions = {}

	var sizeOfOneBar = 240 / optionDomain.length;

	var dimension = profileCrossfilter.dimension(function(d) { return d[optionName] });
	var dimensionGroup = dimension.group();
	charts.push(
		barChart(sizeOfOneBar - 3)
			.dimension(dimension)
			.group(dimensionGroup)
			.x(d3.scale.ordinal()
				.domain(optionDomain)
					// the second parameter is the total WIDTH
					// "10" in this case is the size of each bar.
				.range([0, optionDomain.length*sizeOfOneBar]))
	);
}*/
function initDrawing() {
	charts = [];
	for (var calculationName in window.calculations) {
		var calculationOptions = window.calculations[calculationName];
		var crossfilterOptions = calculationOptions.crossfilter;

		charts.push(
			barChart()
				.dimension(calculationName)
				.graphWidth(240)
				.numberOfBars(crossfilterOptions.numberOfBars)
				.domain([crossfilterOptions.min, crossfilterOptions.max])
				.init(profileCrossfilter)
		);
	}

	// Given our array of charts, which we assume are in the same order as the
	// .chart elements in the DOM, bind the charts to the DOM and render them.
	// We also listen to the chart's brush events to update the display.
	chart = d3.selectAll(".chart")
		.data(charts)
		.each(function(chart) { chart.on("brush", renderAll).on("brushend", renderAll); });

	// Render the initial lists.
	list = d3.selectAll(".list")
		.data([recordList]);

	// Render the total.
	d3.selectAll("#total")
		.text(formatNumber(profileCrossfilter.size()));

	renderAll();
}
initDrawing();


// Renders the specified chart or list.
function render(method) {
	d3.select(this).call(method);
}

// Whenever the brush moves, re-rendering everything.
function renderAll() {
	chart.each(render);
	list.each(render);
	d3.select("#active").text(formatNumber(all.value()));

	d3.selectAll('svg .axis g text').attr('transform', 'translate(7,0) rotate(45)').attr('text-anchor', 'left');
}

window.filter = function(filters) {
	filters.forEach(function(d, i) { charts[i].filter(d); });
	renderAll();
};

window.reset = function(i) {
	charts[i].filter(null);
	renderAll();
};

findCalculationNameByIndex = function(i) {
	var m = 0;
	for (var calculationName in window.calculations) {
		if (m == i) {
			return calculationName;
		}
		m++;
	}
};
/*window.zoomIn = function(i) {
	// TODO does not work yet
	calculationName = findCalculationNameByIndex(i);
	window.calculations[calculationName].crossfilter.globalMin = window.calculations[calculationName].crossfilter.min;
	window.calculations[calculationName].crossfilter.globalMax = window.calculations[calculationName].crossfilter.max;

	var currentBrushExtent = charts[i].currentBrushExtent();
	window.calculations[calculationName].crossfilter.min = currentBrushExtent[0];
	window.calculations[calculationName].crossfilter.max = currentBrushExtent[1];

	initDrawing();
};
window.zoomOut = function(i) {
	// TODO does not work yet
	window.calculations[calculationName].crossfilter.min = window.calculations[calculationName].crossfilter.globalMin;
	window.calculations[calculationName].crossfilter.max = window.calculations[calculationName].crossfilter.globalMax;
	initDrawing();
};*/

function recordList(div) {
	var records = startTimeDimension.top(100);

	div.each(function() {
		var recordSelection = d3.select(this).selectAll(".record")
			.data(records, function(d) { return d.startTime; });

		var recordSelectionEnter = recordSelection.enter().append("tr")
			.attr("class", "record")

		recordSelection.exit().remove();

		recordSelectionEnter.append("td").html(function(d) {
			return '<a onclick="jQuery(\'#file1\').val(\'' + d['id'] + '\');">1</a> '
				+  '<a onclick="jQuery(\'#file2\').val(\'' + d['id'] + '\');">2</a>';
		});

		recordSelectionEnter.append("td").html(function(d) {
			return '<a href="' + window.uris.timelineDetails + '?file1=' + d['id'] + '" class="btn small">Timeline &raquo;</a>'
				+  '<a href="' + window.uris.xhprofDetails + '?run=' + d['id'] + '" class="btn small">XHProf &raquo;</a>'
		});

		for (var optionName in window.options) {
			recordSelectionEnter.append("td")
				.html(function(d) {
					var str = "";
					if (typeof d[optionName] == 'string') str = d[optionName];
					if (str.length > 50) {
						str = '<a title="' + str + '">' + str.substring(0, 50) + '...</a>'
					}

					return str;
			});
		}
		for (var calculationName in window.calculations) {
			if (window.calculations[calculationName].nameOfRowToDisplayInsteadInTable) {
				calculationName = window.calculations[calculationName].nameOfRowToDisplayInsteadInTable;
			}
			recordSelectionEnter.append("td")
				.text(function(d) {return d[calculationName]});
		}

		recordSelection.order()
	});
}

function barChart() {
	if (!barChart.id) barChart.id = 0;

	var margin = {top: 10, right: 30, bottom: 60, left: 30},
		x,
		y = d3.scale.linear().range([100, 0]),
		id = barChart.id++,
		axis = d3.svg.axis().orient("bottom"),
		brush = d3.svg.brush(),
		brushDirty,
		dimension,
		group,
		round,
		barWidth;

	function chart(div) {
		var width = x.range()[1],
			height = y.range()[0];

		y.domain([0, (group.top(1).length > 0 ? group.top(1)[0].value : 0)]);

		div.each(function() {
			var div = d3.select(this),
				g = div.select("g");

			// Create the skeletal chart.
			if (g.empty()) {
				div.select(".title").append("a")
					.attr("href", "javascript:reset(" + id + ")")
					.attr("class", "reset")
					.text("reset")
					.style("display", "none");

				div.select(".title").append("a")
					.attr("href", "javascript:zoomIn(" + id + ")")
					.attr("class", "zoom-in")
					.text("zoom in")
					.style("display", "none");
				div.select(".title").append("a")
					.attr("href", "javascript:zoomOut(" + id + ")")
					.attr("class", "zoom-out")
					.text("zoom out")
					.style("display", "none");

				g = div.append("svg")
					.attr("width", width + margin.left + margin.right)
					.attr("height", height + margin.top + margin.bottom)
				.append("g")
					.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

				g.append("clipPath")
					.attr("id", "clip-" + id)
				.append("rect")
					.attr("width", width)
					.attr("height", height);

				g.selectAll(".bar")
					.data(["background", "foreground"])
				.enter().append("path")
					.attr("class", function(d) { return d + " bar"; })
					.datum(group.all());

				g.selectAll(".foreground.bar")
					.attr("clip-path", "url(#clip-" + id + ")");

				g.append("g")
					.attr("class", "axis")
					.attr("transform", "translate(0," + height + ")")
					.call(axis);

				// Initialize the brush component with pretty resize handles.
				var gBrush = g.append("g").attr("class", "brush").call(brush);
				gBrush.selectAll("rect").attr("height", height);
				gBrush.selectAll(".resize").append("path").attr("d", resizePath);
			}

			// Only redraw the brush if set externally.
			if (brushDirty) {
				brushDirty = false;
				g.selectAll(".brush").call(brush);
				div.select(".title a").style("display", brush.empty() ? "none" : null);
				if (brush.empty()) {
					g.selectAll("#clip-" + id + " rect")
						.attr("x", 0)
						.attr("width", width);
				} else {
					var extent = brush.extent();
					g.selectAll("#clip-" + id + " rect")
						.attr("x", x(extent[0]))
						.attr("width", x(extent[1]) - x(extent[0]));
				}
			}

			g.selectAll(".bar").attr("d", barPath);
		});

		function barPath(groups) {
			var path = [],
				i = -1,
				n = groups.length,
				d;
			while (++i < n) {
				d = groups[i];
				path.push("M", x(d.key), ",", height, "V", y(d.value), "h", barWidth, "V", height);
			}
			if (path.length == 0) {
				path.push("M0,0");
			}
			return path.join("");
		}

		function resizePath(d) {
			var e = +(d == "e"),
				x = e ? 1 : -1,
				y = height / 3;
			return "M" + (.5 * x) + "," + y
				+ "A6,6 0 0 " + e + " " + (6.5 * x) + "," + (y + 6)
				+ "V" + (2 * y - 6)
				+ "A6,6 0 0 " + e + " " + (.5 * x) + "," + (2 * y)
				+ "Z"
				+ "M" + (2.5 * x) + "," + (y + 8)
				+ "V" + (2 * y - 8)
				+ "M" + (4.5 * x) + "," + (y + 8)
				+ "V" + (2 * y - 8);
		}
	}

	brush.on("brushstart.chart", function() {
		var div = d3.select(this.parentNode.parentNode.parentNode);
		div.selectAll(".title a").style("display", null);
	});

	brush.on("brush.chart", function() {
		var g = d3.select(this.parentNode),
			extent = brush.extent();
		if (round) g.select(".brush")
				.call(brush.extent(extent = extent.map(round)))
			.selectAll(".resize")
				.style("display", null);
		g.select("#clip-" + id + " rect")
			.attr("x", x(extent[0]))
			.attr("width", x(extent[1]) - x(extent[0]));
		dimension.filterRange(extent);
	});

	brush.on("brushend.chart", function() {
		if (brush.empty()) {
			var div = d3.select(this.parentNode.parentNode.parentNode);
			div.select(".title a").style("display", "none");
			div.select("#clip-" + id + " rect").attr("x", null).attr("width", "100%");
			dimension.filterAll();
		}
	});

	chart.margin = function(_) {
		if (!arguments.length) return margin;
		margin = _;
		return chart;
	};

	chart.x = function(_) {
		if (!arguments.length) return x;
		x = _;
		axis.scale(x);

		brush.x(x);
		return chart;
	};

	chart.y = function(_) {
		if (!arguments.length) return y;
		y = _;
		return chart;
	};

	chart.filter = function(_) {
		if (_) {
			brush.extent(_);
			dimension.filterRange(_);
		} else {
			brush.clear();
			dimension.filterAll();
		}
		brushDirty = true;
		return chart;
	};

	chart.group = function(_) {
		if (!arguments.length) return group;
		group = _;
		return chart;
	};

	chart.currentBrushExtent = function() {
		return brush.extent();
	};

	chart.round = function(_) {
		if (!arguments.length) return round;
		round = _;
		return chart;
	};

	/**
	 * a more high-level API to build charts
	 */
	var dimensionFn, graphWidth, numberOfBars, domain;
	chart.dimension = function(_) {
		if (typeof _ == 'string') {
			var dimensionName = _;
			_ = function(d) {return d[dimensionName]};
		}
		dimensionFn = _;
		return chart;
	}
	chart.graphWidth = function(_) {
		graphWidth = _;
		return chart;
	}
	chart.numberOfBars = function(_) {
		numberOfBars = _;
		return chart;
	}
	chart.domain = function(_) {
		domain = _;
		return chart;
	}
	chart.init = function(crossfilter) {
			// range of one bar = (domain[max]-domain[min]) / numberOfBars
		var rangeOfOneBar = (domain[1]-domain[0]) / numberOfBars;
		barWidth = (graphWidth / numberOfBars) - 2;

		dimension = crossfilter.dimension(function(d) { return Math.floor(dimensionFn(d) / rangeOfOneBar) * rangeOfOneBar });
		var dimensionGroup = dimension.group();

		chart.group(dimensionGroup)
			 .x(d3.scale.linear()
				.domain([domain[0], domain[1]])
				.nice()
					// the "range" in this case is the pixel size of the graph
				.rangeRound([0, graphWidth])
		     ).round(function(value) {
				return Math.floor(value / rangeOfOneBar) * rangeOfOneBar;
			 });

		return chart;
	};

	return d3.rebind(chart, brush, "on");
}