'use strict';

function InitCountryLoad(val) {
    $.ajax({
        type: 'GET',
        url: "/get_country_load/" + val,
        async: true,
        success: function (result) {
            if (result.val == undefined || result.val == "") {
                return;
            }

            var labels = [];
            var vals = [];
            var null_vals = [];
            var items = result.val.split(",");
            for (var i = 0; i < items.length; ++i) {
                var tmp_item = items[i].split(":");
                if (tmp_item.length != 2) {
                    continue;
                }
                labels.push(tmp_item[0]);
                vals.push(tmp_item[1]);
                null_vals.push(0);
            }

            var areaChartData = {
                labels: labels,
                datasets: [
                  {
                      label: 'Electronics',
                      fillColor: 'rgba(210, 214, 222, 1)',
                      strokeColor: 'rgba(210, 214, 222, 1)',
                      pointColor: 'rgba(210, 214, 222, 1)',
                      pointStrokeColor: '#c1c7d1',
                      pointHighlightFill: '#fff',
                      pointHighlightStroke: 'rgba(220,220,220,1)',
                      data: null_vals
                  },
                  {
                      label: 'Digital Goods',
                      fillColor: 'rgba(60,141,188,0.9)',
                      strokeColor: 'rgba(60,141,188,0.8)',
                      pointColor: '#3b8bba',
                      pointStrokeColor: 'rgba(60,141,188,1)',
                      pointHighlightFill: '#fff',
                      pointHighlightStroke: 'rgba(60,141,188,1)',
                      data: vals
                  }
                ]
            }

            var barChartCanvas = $('#barChart').get(0).getContext('2d')
            var barChart = new Chart(barChartCanvas)
            var barChartData = areaChartData
            barChartData.datasets[1].fillColor = '#00a65a'
            barChartData.datasets[1].strokeColor = '#00a65a'
            barChartData.datasets[1].pointColor = '#00a65a'
            var barChartOptions = {
                //Boolean - Whether the scale should start at zero, or an order of magnitude down from the lowest value
                scaleBeginAtZero: true,
                //Boolean - Whether grid lines are shown across the chart
                scaleShowGridLines: true,
                //String - Colour of the grid lines
                scaleGridLineColor: 'rgba(0,0,0,.05)',
                //Number - Width of the grid lines
                scaleGridLineWidth: 1,
                //Boolean - Whether to show horizontal lines (except X axis)
                scaleShowHorizontalLines: true,
                //Boolean - Whether to show vertical lines (except Y axis)
                scaleShowVerticalLines: true,
                //Boolean - If there is a stroke on each bar
                barShowStroke: true,
                //Number - Pixel width of the bar stroke
                barStrokeWidth: 2,
                //Number - Spacing between each of the X value sets
                barValueSpacing: 5,
                //Number - Spacing between data sets within X values
                barDatasetSpacing: 1,
                //String - A legend template
                legendTemplate: '<ul class="<%=name.toLowerCase()%>-legend"><% for (var i=0; i<datasets.length; i++){%><li><span style="background-color:<%=datasets[i].fillColor%>"></span><%if(datasets[i].label){%><%=datasets[i].label%><%}%></li><%}%></ul>',
                //Boolean - whether to make the chart responsive
                responsive: true,
                maintainAspectRatio: true
            }

            barChartOptions.datasetFill = false
            barChart.Bar(barChartData, barChartOptions)
        }
    });
}

function DateAdd(interval, number, date) {
    switch (interval) {
        case "y ": {
            date.setFullYear(date.getFullYear() + number);
            return date;
            break;
        }
        case "q ": {
            date.setMonth(date.getMonth() + number * 3);
            return date;
            break;
        }
        case "m ": {
            date.setMonth(date.getMonth() + number);
            return date;
            break;
        }
        case "w ": {
            date.setDate(date.getDate() + number * 7);
            return date;
            break;
        }
        case "d ": {
            date.setDate(date.getDate() + number);
            return date;
            break;
        }
        case "h ": {
            date.setHours(date.getHours() + number);
            return date;
            break;
        }
        case "m ": {
            date.setMinutes(date.getMinutes() + number);
            return date;
            break;
        }
        case "s ": {
            date.setSeconds(date.getSeconds() + number);
            return date;
            break;
        }
        default: {
            date.setDate(d.getDate() + number);
            return date;
            break;
        }
    }
}

function ThirtyDaysAlives() {
    $.ajax({
        type: 'GET',
        url: "/get_day_alives",
        async: true,
        success: function (result) {
            var days_alives = []
            var labels_arr = [];
            var items = result.val.split(",");
            var now = new Date();
            for (var i = items.length - 1; i >= 0; --i) {
                if (items[i] == "") {
                    continue;
                }
                days_alives.push(items[i]);

                var now = new Date();
                var newDate = DateAdd("d ", -i, now);
                labels_arr.push(newDate.toLocaleDateString());
            }
            var addr_data = {
                labels: labels_arr,
                datasets: [
                  {
                      label: 'Electronics',
                      fillColor: 'rgba(210, 214, 222, 1)',
                      strokeColor: 'rgba(210, 214, 222, 1)',
                      pointColor: 'rgba(210, 214, 222, 1)',
                      pointStrokeColor: '#c1c7d1',
                      pointHighlightFill: '#fff',
                      pointHighlightStroke: 'rgba(220,220,220,1)',
                      data: days_alives
                  }
                ]
            }
            var areaChartOptions = {
                showScale: true,
                scaleShowGridLines: false,
                scaleGridLineColor: 'rgba(0,0,0,.05)',
                scaleGridLineWidth: 1,
                scaleShowHorizontalLines: true,
                scaleShowVerticalLines: true,
                bezierCurve: true,
                bezierCurveTension: 0.3,
                pointDot: false,
                pointDotRadius: 4,
                pointDotStrokeWidth: 1,
                pointHitDetectionRadius: 20,
                datasetStroke: true,
                datasetStrokeWidth: 2,
                datasetFill: true,
                legendTemplate: '<ul class="<%=name.toLowerCase()%>-legend"><% for (var i=0; i<datasets.length; i++){%><li><span style="background-color:<%=datasets[i].lineColor%>"></span><%if(datasets[i].label){%><%=datasets[i].label%><%}%></li><%}%></ul>',
                maintainAspectRatio: true,
                responsive: true
            }

            var lineChartCanvas = $('#lineChart5').get(0).getContext('2d')
            var lineChart = new Chart(lineChartCanvas)
            var lineChartOptions = areaChartOptions
            lineChartOptions.datasetFill = false
            lineChart.Line(addr_data, lineChartOptions)
        }
    });
}

InitCountryLoad(1);
ThirtyDaysAlives();