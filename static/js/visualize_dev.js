//GLOBALS
var CALDATA = [];
var WINDOW_LENGTH = 10; 
var FILTERS = [];
var CALRANGE = 1;
var WORDCOUNTS = {}
var n_toplabels = 10;
var n_precolumns = 8;


//$.getJSON('test.json', function(data) {
//  console.log(data);
//});



//********************************************************
//				PROCESS RAW DATA FROM GOOGLE
//********************************************************
function CalendarSelect() {

	//ask user to select relevant calendars
	calendars = getCalendars(RAW_EVENTS_LIST);

	$.each(calendars,function(e,item){
		$('#calendar-select').append('<div class="checkbox"><label><input name="calendar" type="checkbox" value="'+item+'">'+item+'</label></div>');
	})

	//upon clicking calendar select button
	$( "#calendar-select-button" ).click(function() {

		$("html, body").animate({ scrollTop: 0 }, 200);

		//display progress bar
		var event_chunking = 1000;
		PROGRESS_CURRENT = 1;
		PROGRESS_TOTAL = Math.ceil(RAW_EVENTS_LIST.length/(1.0*event_chunking))+1+4; //+4 for the filter processing, etc.
		$(".progress-bar").attr('style','width:'+(100*PROGRESS_CURRENT/PROGRESS_TOTAL)+"%");
		
		//TODO - needs to be smoother hide charts
		$("html, body").animate({ scrollTop: 0 }, 200);
        //$('#authOps').hide('slow');

		$('#progress').slideDown('fast', function(){

			//set calendar filter
			general_calendar_filter = $.map($('input[name=calendar]:checked'),function(item){return $(item).val();} );

			//check empty calendar selection
			if (general_calendar_filter.length == 0 ){
				alert('Pick at least one calendar.');
			}

			//reset CALDATA, parse JSON parallelly
			CALDATA = [['Event','Duration','Start','CalName','Realduration','Deadtime','pre-planning','best_filter']];
			WORDCOUNTS = {};
			for (var i=0; i < RAW_EVENTS_LIST.length; i+=event_chunking){
				processJSON(RAW_EVENTS_LIST.slice(i,i+event_chunking),general_calendar_filter);
			}

		}).delay(50).slideUp('fast'); 

	}); //END upon clicking calendar select button


	//upon clicking filter select button
	$( "#filter-select-button" ).click(function() {

		//create filters
		filternames = $.map($('input[name=filter]:checked'),function(item){return $(item).val();} );
		arrayLength = filternames.length
		FILTERS = []
		for (var i = 0; i < arrayLength; i++) {
			FILTERS.push({
					name: filternames[i],
					keywords: [filternames[i]],
					calendars: []
				});
		}//END create filters

		//load charts
		loadCharts();

	});

} //END CALENDAR SELECT

//********************************************************
//				FILTER PROCESSING
//********************************************************
function filter_processing(update){

	//console.log('called filter processing');
	//console.log(FILTERS);

	update = parseInt(update) || -1;

	//remove duplicate filters
	filter_meshing();

	//save filters
	$.post('savefilters', {email:USER.email, filters:JSON.stringify(FILTERS) }, function(data){console.log(data);});

	$.each(FILTERS,function(index,item){

		var best_name = 'Deadtime';
		var best_dura = 0;

		if (update < 0){
			//add column name
			CALDATA[0].push(item['name']);
		}else if(index == update){
			CALDATA[0][update+n_precolumns] = item['name'];
			//console.log(CALDATA[0][update+n_precolumns]);
		}

		//go through each event
		$.each(CALDATA.slice(1),function(cal_index,cal_item){

			var dura = 0;

			//loop over keywords
			for(var i = 0; i < item['keywords'].length; i++){

				//search event title
				if (cal_item[0].indexOf( item['keywords'][i] ) >= 0){

					//add time to filter column
					dura = cal_item[1];
				}
			}

			if (update < 0){
				//push a column
				cal_item.push(dura);
			}else if(update == index){
				cal_item[update+n_precolumns] = dura;
			}

		});

	});


	var filter_names = CALDATA[0].slice(n_precolumns)

	for(var x = 1; x < CALDATA.length; x ++){

		//default label to "Everything Else"
		var filter_i = 0

		//get real filter columns
		var duras = CALDATA[x].slice(n_precolumns +1)
		var max_dura = Math.max.apply(Math, duras)

		if (max_dura > 0){
			//find argmax of the durations from the filter columns
			filter_i = duras.indexOf(max_dura) + 1
			//set 'Everything Else' time to 0 if these is a label
			CALDATA[x][n_precolumns] = 0
		}

		//set best filter column to name of best filter
		CALDATA[x][n_precolumns-1] = filter_names[filter_i]

		//check for deadtime
		if (isNaN(CALDATA[x][1])){
			//set 'best filter' as Deadtime
			CALDATA[x][n_precolumns-1] = 'Deadtime'
			//set 'Everything Else' filter to 0
			CALDATA[x][n_precolumns] = 0
		}
	}




	//update progress bar
	PROGRESS_CURRENT += 1;
	$(".progress-bar").attr('style','width:'+(100*PROGRESS_CURRENT/PROGRESS_TOTAL)+"%");
}




//********************************************************
//				LOAD CHARTS
//********************************************************
function loadCharts(){

	//store data
	$.post('datalog', {email:USER.email, data:JSON.stringify(CALDATA) }, function(data){console.log(data);})

	//load google Charts
	if(google) {
		google.load('visualization', '1.0', {
			packages: ['corechart','controls','calendar'],
			callback: function() {
				drawDashboard(CALDATA);
			}
		} )
	} //END load Google charts

	//display average deadtime
	var Sum_dt = 0;
	var Sum_ppt = 0;
	var Sum_ibt = 0;
	var ct_dt = 0;
	var ct_ppt = 0;
	var ct_ibt = 0;
	var yesterday = new Date('0000/10/01');

	for(var x = 1; x < CALDATA.length; x ++){

		if (typeof CALDATA[x] === 'undefined'){
			//console.log(x);
		}

		//get deadtime
		if (CALDATA[x][5] != 0 && CALDATA[x][5] < 24 ){ //EXCLUDE NO EVENT DAYS
			Sum_dt += parseFloat(CALDATA[x][5]);
			ct_dt += 1; //TODO ACCOUNT FOR COMPLETELY FULL CALENDARS
		}
		//get pre-planning time
		if (CALDATA[x][6] != 0){
			Sum_ppt += parseFloat(CALDATA[x][6]);
			ct_ppt += 1;
			if (isNaN(Sum_ppt) ){
				////console.log(CALDATA[x][6]);
			}
		}
		//get in-between time
		var today = new Date(CALDATA[x][2]);
		var timediff = Math.abs(today-yesterday)/3600000;
		var today_duration = CALDATA[x][1]

		if ( timediff > 0 && timediff < 4 && today_duration > 0 ){
			Sum_ibt += Math.abs(today-yesterday)/3600000;
			ct_ibt += 1;
		}
		yesterday = new Date(today.getTime() + (today_duration *3600000))

	}

	//DISPLAY AGGREGATED STATS
	var daily_hours = Math.round(240 - Sum_dt/ct_dt*10)/10;
	$('#deadtime_jumbo h1').html(daily_hours + " hrs");
	$('#deadtime_jumbo .compare').html("That puts you in the approx. "+normalcdf(2,2,daily_hours)+"th percentile of our user base.");
	var pre_plan_time = Math.round(Sum_ppt/ct_ppt*10)/10;
	$('#preplan_jumbo h1').html(pre_plan_time + " days");
	$('#preplan_jumbo .compare').html("You plan more ahead of time than approx. "+normalcdf(7,2,pre_plan_time)+"% of our user base.");
	var in_between_time = Math.round(Sum_ibt/ct_ibt*10)/10;
	$('#inbetween_jumbo h1').html( in_between_time+ " hrs");
	$('#inbetween_jumbo .compare').html("You spend less time between events than "+(100-normalcdf(2,2,in_between_time))+"% of our user base.");
	
	//display personas
	$('#persona_jumbo h1').html(PERSONAS['LLLH']['name']);
	$('#persona_jumbo .compare').html(PERSONAS['LLLH']['description']);

	//update progress bar
	PROGRESS_CURRENT += 1;
	$(".progress-bar").attr('style','width:'+(100*PROGRESS_CURRENT/PROGRESS_TOTAL)+"%");

	//show charts
	$("html, body").animate({ scrollTop: 0 }, 200);
    $('#authOps').show('slow');


}


//********************************************************
//				LEARN FILTERS
//********************************************************
function learnfilters(data) {

	//console.log('called learn filters');
	//console.log(FILTERS);

	//get sorted filters for the user
	$.get('savefilters', {email:USER.email} ,function(response){

		//check data none ==> new user, no filters saved
		if (response=='[null]'){
			//learn filters

			//get sortable array of keywords
			var moo = []
			for (var key in data) {
			  if (data.hasOwnProperty(key)) {
				moo.push({"word":key ,"val":data[key][1]});
			  }
			} 
			var filterslist = moo.sort(function(a, b) {return b["val"] - a["val"]})

			//load filters for all events 
			FILTERS = []
			FILTERS.push({
					name: "Unlabeled",
					keywords: [""],
					calendars: []
				});

			//console.log(filterslist);
			//console.log(n_toplabels);

			//by default, push top n filters
			for (var i = 0; i < n_toplabels+1; i++) {
				FILTERS.push({
						name: filterslist[i]['word'].substring(1),
						keywords: [filterslist[i]['word'].substring(1)],
						calendars: []
					});
			}

			//console.log(FILTERS);

			//filter CALDATA
			filter_processing();

			//show filters
			showFilters();

		}else{
			//load saved filter
			FILTERS = $.parseJSON( response );

			//filter CALDATA
			filter_processing();

			//show filters
			showFilters();
		}

	});	

	//update progress bar
	PROGRESS_CURRENT += 1;
	$(".progress-bar").attr('style','width:'+(100*PROGRESS_CURRENT/PROGRESS_TOTAL)+"%");

}


//********************************************************
//				GET CALENDAR NAMES
//********************************************************
function getCalendars(data) {
	var cal_names = [];
	var occ = {}
	$.each(data,function(index,item){

		if ((typeof item.summary != 'undefined') & (typeof item.start != 'undefined')){
			//filter out full-day events
			if (typeof item.start.dateTime != 'undefined'){
				if (cal_names.indexOf( item.calendarname) < 0 ){
					cal_names.push(item.calendarname);
					occ[item.calendarname] = 0
				}

				//check item creator
				if(item.creator.email  != 'undefined' && item.creator.email == USER.email){
					occ[item.calendarname] += 50;
				}else{
					occ[item.calendarname] += 1;
				}
			}
		}
	});

	return cal_names.sort(function(a,b){return occ[b] - occ[a] });
}

//

//********************************************************
//				BASIC DATA PROCESSING
//********************************************************

function processJSON(data,general_calendar_filter) {

	//set variables
	var n_events = 0;
	var dead_time = {};
	var wordCounts = {};
	var dead_accuracy = 15; //in minutes

	//set arrays
	var caldata = [];

	//parse data from JSON
	$.each(data,function(index,item){

		//check that item is well-formed
		if ((typeof item.summary != 'undefined') & (typeof item.start != 'undefined')){
			//filter out full-day events
			if (typeof item.start.dateTime != 'undefined'){
				if (general_calendar_filter.indexOf( item.calendarname) > -1 ){

					//array of event subdata
					var event_data = [];

					//get title words
					var event_title = item.summary.toLowerCase()

					//get time created
					var created_date = new Date( item.updated );

					//get start
					var st_date = new Date( item.start.dateTime );

					//get end
					var end_date = new Date( item.end.dateTime );
					var key = new Date(st_date)
					key.setHours(0,0,0,0);
					if (dead_time[key] == undefined){
						//get array with times at every dead_accuracy minutes
						dead_time[key] = [];
						var d = key;
						for (var i = 0; i < 24*60/dead_accuracy; i++){
						  dead_time[key].push( d );
						  d = new Date( d.getTime() + dead_accuracy*60*1000 );  // 10 minutes in milliseconds
						}
					}
					var new_dead_time = []
					var arrayLength = dead_time[key].length;
					for (var i = 0; i < arrayLength; i++) {
						if (dead_time[key][i] >= end_date || dead_time[key][i] < st_date){
							new_dead_time.push(dead_time[key][i]);
						}
					}
					//get real duration, which is the amount of deadtime that was claimed by event
					var real_duration = (dead_time[key].length - new_dead_time.length)*dead_accuracy/60
					dead_time[key] = new_dead_time;

					//get duration
					var timeDiff = Math.abs(end_date - st_date)/3600000;

					//get pre-planning time, not for recurring events tho
					if (item.recurrence == undefined && item.recurringEventId==undefined){
						var planningtimeDiff = Math.abs(st_date - created_date)/3600000/24;
						//if (planningtimeDiff < -5){
							////console.log(item.summary + ";"+planningtimeDiff + ";"+st_date + ";"+created_date)
						//}
					}else{
						var planningtimeDiff = 0;
					}

					//get calendar
					var calendar_name = item.calendarname;

					//count words used in title
					var words = event_title.split(/[\b, ,\],\[,\:]/);
					for(var i = 0; i < words.length; i++){
						//if not stopword
						if (stopwords.indexOf(words[i]) == -1){
							//if exists
							if((wordCounts["_" + words[i]] || 0)){
								wordCounts["_" + words[i]] = [wordCounts["_" + words[i]][0] + 1, wordCounts["_" + words[i] ][1] + timeDiff];
							}else{
								wordCounts["_" + words[i]] = [1,timeDiff];
							}
						}
					}
					//add n-grams to the list
					for (var n = 2; n<words.length-1; n++){
						for(var i = 0; i < words.length-(n-1); i++){
							ngram = "_" + words.slice(i, i+n).join(' ');
							//if exists
							if((wordCounts[ngram] || 0)){
								wordCounts[ngram] = [wordCounts[ngram][0] + 1, wordCounts[ngram][1] + timeDiff];
							}else{
								wordCounts[ngram] = [1,timeDiff];
							}

						}
					}

					//save data
					event_data[0] = event_title;
					event_data[1] = timeDiff;
					event_data[2] = st_date;
					event_data[3] = calendar_name;
					event_data[4] = real_duration;
					event_data[5] = 0; //deadtime
					event_data[6] = planningtimeDiff;
					event_data[7] = "";

					//add to dataset
					caldata[n_events] = event_data;

					n_events += 1;

		}}}//END the three (ifs) general calendar filters

	}); //END Pasrse data from JSON

	//add to CALDATA, sort
	CALDATA = CALDATA.concat(caldata);

	//add to WORDCOUNTS
	for (key in wordCounts){
		if((WORDCOUNTS[key] || 0)){
			WORDCOUNTS[key] = [WORDCOUNTS[key][0] + wordCounts[key][0], WORDCOUNTS[key][1] + wordCounts[key][1]];
		}else{
			WORDCOUNTS[key] = wordCounts[key];
		}
	}

	//update progress bar
	PROGRESS_CURRENT += 1;
	$(".progress-bar").attr('style','width:'+(100*PROGRESS_CURRENT/PROGRESS_TOTAL)+"%");

	//check all finished
	if (PROGRESS_CURRENT == PROGRESS_TOTAL - 4){
		//call successors

		//display enitre dashboard and shrink calendar up
		$('#calendar-select').animate({height: "100px"}, 1500 );
		$('#dashboard_div').css('visibility', 'visible');

		//var output = processJSON(RAW_EVENTS_LIST,general_calendar_filter);
		CALDATA.sort(function(a,b){return new Date(a[2]) - new Date(b[2]);});

		//Calculate deadtime
		var range_start = CALDATA[1][2].setUTCHours(0,0,0,0);
		var range_end = CALDATA.slice(-1)[0][2].setUTCHours(0,0,0,0);
		var caldata_i = 1;

		while(range_start <= range_end){
			//start summing real duration
			var real_duration_sum = 0;

			//iterate through CALDATA and sum
			while (CALDATA[caldata_i][2].setUTCHours(0,0,0,0) == range_start && caldata_i < CALDATA.length){
				real_duration_sum += CALDATA[caldata_i][4];
				caldata_i++;
			}
			//add event to caldata
			CALDATA.push(['Deadtime',NaN, new Date(range_start),'Deadtime',0, (24.0-real_duration_sum) ,0, ""]);

			//increment date
			range_start += 86400000;
		}

		//update progress bar
		PROGRESS_CURRENT += 1;
		$(".progress-bar").attr('style','width:'+(100*PROGRESS_CURRENT/PROGRESS_TOTAL)+"%");

		//Store data
		/*$.post( "database", { caldata:  escape(JSON.stringify(CALDATA)), user: escape(USER['email']) })
		  .done(function( data ) {
		    //console.log( data );
		  });*/

		//learn filters and populate list
		learnfilters(WORDCOUNTS);

		//load charts
		loadCharts();

	}//END Progress bar check

}


//********************************************************
//				DRAW DASHBOARD
//********************************************************

function drawDashboard(caldata) {

	// Create our data table.
	var data = google.visualization.arrayToDataTable(caldata);

	// Create a dashboard.
	var dashboard = new google.visualization.Dashboard(
		document.getElementById('dashboard_div'));

	// Create a range slider, passing some options
	var FilterPicker = new google.visualization.ControlWrapper({
	  'controlType': 'CategoryFilter',
	  'containerId': 'filter_div',
	  'options': {
		'filterColumnLabel': 'best_filter',
		'ui':{label: '', caption: "Narrow Filter Selection"}
	  }
	});

	var moo = new Date();
	var timeSlider = new google.visualization.ControlWrapper({
		'controlType': 'DateRangeFilter',
		'containerId': 'filter_div2',
		'options': {
		  filterColumnIndex: 2,
		  maxValue: moo
		}
	  });

	//create histogram
	var histogram = new google.visualization.ChartWrapper({
		'chartType': 'Histogram',
		'containerId': 'chart_div',
		'view': {'columns': [0, 1]},
		'options': {
						title: 'Event Duration, hours',
						legend: { position: 'none' },
						animation: {
							duration:200, 
							easing:'linear'
						},
						hAxis: {
							viewWindow: {max:15},
							showTextEvery: 2
						},
						vAxis: {
							gridlines: {color: '#FFF'}
						},
						histogram: {bucketSize: 0.5},
						chartArea: {backgroundColor: "#FFEFD9"}, //http://paletton.com/#uid=10J0u0khrWn4N+-bTYOmaSDqEM8
						colors: ["#FFA62B"]
					}
	});//END histogram

	//create calendar chart
	google.visualization.events.addListener(dashboard, 'ready', function() {

		//get date range from date slider
		var dr = $.map($('#filter_div2 .google-visualization-controls-rangefilter-thumblabel'),function(item){return new Date($(item).html());} );
		WINDOW_LENGTH = Math.ceil((dr[1] - dr[0])/(90*86400000));

		//get selected filters, init stuff
		var selector_state = FilterPicker.getState();
		
		//force add deadtime
		if (selector_state.selectedValues.length > 0 && selector_state.selectedValues.indexOf('Deadtime')<0){
			selector_state.selectedValues.push('Deadtime');
			FilterPicker.setState(selector_state);
			//console.log('forced');
			dashboard.draw(data);
		}

		//get selected filters
		var selected_filters = selector_state.selectedValues;

		//get real filter names
		var filter_names = CALDATA[0].slice(n_precolumns);

		var show_columns = [0];

		//if user has not selected yet
		if (selected_filters.length == 0){
			//add all columns
			for(var i = 4; i < n_toplabels+4; i++){ 
				show_columns.push(i); //for the graph to display
			}
		} else {
			//push the filter index to the show_columns list (for the area chart only, so deadtime not needed)
			for( var i = 0; i < selected_filters.length; i++){
				if (selected_filters[i] != 'Deadtime'){
					show_columns.push(filter_names.indexOf(selected_filters[i])+4);
				}
			} 
		}

		//call aggregation functions for grouped dt.
		var agg_functions = [
								//date is [0]
								{'column': 1, 'aggregation': date_avg, 'type': 'number'}, //total duration [1]
						  		{'column': 4, 'aggregation': date_avg, 'type': 'number'}, //real duration [2]
						  		{'column': 5, 'aggregation': date_avg, 'type': 'number'}  //deadtime [3]
						  		//6 is preaction time,  n_precolumns is unlabeled, 
						  	]
		
		//add filters to group_dt
		for(var i = n_precolumns; i < n_precolumns+n_toplabels; i++){ 
			agg_functions.push({'column': i, 'aggregation': date_avg, 'type': 'number'});
		}

		var dt=histogram.getDataTable();
		var grouped_dt = google.visualization.data.group(
						  dt, [{column:2, modifier:discretize_date, type:'date'}], agg_functions);

		/*var calendar_chart = new google.visualization.ChartWrapper({
			  'chartType': 'Calendar',
			  'containerId': 'calendar_div',
			  'view': {'columns': [0, 2]},
			  'dataTable':grouped_dt
			});
		calendar_chart.draw();*/

		var dash_area_chart = new google.visualization.ChartWrapper({
			  'chartType': 'AreaChart',
			  'containerId': 'chart_div4',
			  'view': {'columns': show_columns},
			  'dataTable':grouped_dt,
			  'options':{
							title: 'TOP FIVE DETECTED LABELS: average hours per day, smoothed by '+WINDOW_LENGTH+' days',
							isStacked: true,
							vAxis: {
								gridlines: {}
							},
							'explorer':{
								 keepInBounds: true,
								 zoomDelta: 1.1,
								 maxZoomOut: 1,
								 maxZoomIn: .2,
								 axis: 'horizontal'
							}
						}
			});
		dash_area_chart.draw();

		//graph deadtime
		var deadtime_chart = new google.visualization.ChartWrapper({
			  'chartType': 'AreaChart',
			  'containerId': 'chart_div5',
			  'view': {'columns': [0, 3]},
			  'dataTable':grouped_dt,
			  'options':{
							title: 'DEADTIME, average hours per day',
							isStacked: true,
							vAxis: {
								gridlines: {}
							},
							'explorer':{
								 keepInBounds: true,
								 zoomDelta: 1.1,
								 maxZoomOut: 1,
								 maxZoomIn: .5,
								 axis: 'horizontal'
							}
						}
			});
		deadtime_chart.draw();


	}); //END calendar chart



	// Establish dependencies
	dashboard.bind([timeSlider,FilterPicker], [histogram]);

	// Draw the dashboard.
	dashboard.draw(data);

	//modify chart
	////console.log(histogram.getDataURL());
	/*histogram.setOptions({
							title: 'Event Duration, hours',
							legend: { position: 'none' },
							animation: {
								duration:200, 
								easing:'linear'
							},
							hAxis: {
								viewWindow: {max:15},
								showTextEvery: 2
							}
						});*/
	//histogram.draw;

}//END Draw Dashboard


//********************************************************
//				DATA MODIFIER DISCRETISE DATES
//********************************************************

function discretize_date(inddate){
	var result = new Date(inddate);
	result.setTime(inddate.getTime() - inddate.getTime()%(WINDOW_LENGTH*86400000));
	return result;
}

//********************************************************
//				AVERAGE DATES
//********************************************************
function date_avg(values){
	var count=0;
	for (var i=values.length; i--;) {
		count+=values[i];
	}
	return count/WINDOW_LENGTH;
}

//********************************************************
//				SHOW FILTERS
//********************************************************
function showFilters(){

	//console.log('showfilters called');

	//clear the space
	$('#accordion').html('');

	//loop over the filters
	for (var i=1; i < FILTERS.length; i++){

		var start_html = '<div class="panel panel-default"><div class="panel-heading" role="tab" id="heading'+i+'"><h4 class="panel-title"><a data-toggle="collapse" data-parent="#accordion" href="#collapse'+i+'" aria-expanded="false" aria-controls="collapse'+i+'">'
		var header_content = FILTERS[i]['name']
		var middle_html = '</a></h4></div><div id="collapse'+i+'" class="panel-collapse collapse" role="tabpanel" aria-labelledby="heading'+i+'"><div class="panel-body">'
		var body_content = '<form class="form-horizontal" role="form" id="filter_edit_'+i+'"><div class="form-group"><label for="inputEmail3" class="col-sm-2 control-label">Name</label><div class="col-sm-10"><input class="form-control" name="filter_name" value="'+FILTERS[i]['name']+'"></div></div><div class="form-group"><label for="inputPassword3" class="col-sm-2 control-label">Keywords</label><div class="col-sm-10">'
		var keyword_options = ''

		for (var j=FILTERS[i]['keywords'].length; j--;){
			keyword_options += '<div class="col-xs-3" style="padding-left: 0px;"><input name="filterkeyword" class="form-control" id="inputEmail3" value="'+FILTERS[i]['keywords'][j]+'" placeholder="Edit existing keyword"></div>'
		}

		for (var j=3; j--;){
			keyword_options += '<div class="col-xs-3" style="padding-left: 0px;"><input class="form-control" name="filterkeyword" placeholder="Add new keyword"></div>'
		}

		var closing_html = '</div></div><div class="form-group"><div class="col-sm-offset-2 col-sm-10"><button type="submit" class="btn btn-default updatefilter" filter_i="'+i+'">Update Filter</button></div></div></form></div></div></div>'

		$('#accordion').append(start_html+header_content+middle_html+body_content+keyword_options+closing_html)
	}

	//bind update function to buttons
	$( ".updatefilter" ).click(function( event ) {
  		event.preventDefault();
  		var filter_i = $(this).attr('filter_i');

  		//get stuff from form
  		newname = $('#filter_edit_'+filter_i+' input[name=filter_name]').val();
  		newkeywords = $.map($('#filter_edit_'+filter_i+' input[name=filterkeyword]'),function(item){return $(item).val();} ).filter(function(n){ return n != '' });

  		//check empty
  		if (newname.length == 0){
  			alert('Please specify a name for the filter.');
  			return 0;
  		}
  		if (newkeywords.length == 0){
  			alert('Please specify at least one keyword for the filter.');
  			return 0;
  		}

  		//upadte filter
  		FILTERS[filter_i]['name'] = newname;
  		FILTERS[filter_i]['keywords'] = newkeywords;

  		//filter CALDATA
		filter_processing(filter_i);

		//load charts
		loadCharts();

		//show filters
		showFilters();

	});

}

//********************************************************
//				UPDATE FILTERS PROCESSING
//********************************************************
function filter_meshing(){

	var new_FILTER = []

	//add Unlabeled filter by default
	new_FILTER.push(FILTERS[0]);

	//go through filters
	for (var f =1; f < FILTERS.length; f++ ){

		var filt_delete = 0;

		//loop through keywords
		for( var q = 0; q < FILTERS[f]['keywords'].length; q ++){

			var item = FILTERS[f]['keywords'][q];

			//loop through other filters
			for (var k = 1; k < FILTERS.length; k++ ){
				
				//check if keyword is inside another filter
				if ( k != f &&  FILTERS[k]['keywords'].join('|').indexOf(item) > -1 ){
					filt_delete ++;
					break;
				}
			}
		}

		//if not all keywords have been associated with other filters, keep
		if(filt_delete < FILTERS[f]['keywords'].length){
			new_FILTER.push(FILTERS[f]);
		}

	}
	//edit global
	FILTERS =  new_FILTER
	n_toplabels = new_FILTER.length
}

