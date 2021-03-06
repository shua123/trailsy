'use strict'
var L = require('leaflet')
var Tangram = require('tangram')
var $ = require('jquery')
require('./vendor/leaflet.zoomcss.js')
require('leaflet-boundsawarelayergroup')
require('leaflet.markercluster')
var esri = require('esri-leaflet')
require('jquery-address')
require('svgxuse')
var Config = require('./config.js')
var analyticsCode = require('./analyticsCode.js')
var poiFeature = require('./poiFeature.js')
var trailSegmentFeature = require('./trailSegmentFeature.js')
var trailInfo = require('./trailInfo.js')
var activityFeature = require('./activityFeature.js')
var picnicgroveFeature = require('./picnicgroveFeature.js')
var geolocationFunctions = require('./geolocationFunctions.js')
var filterFunctions = require('./filterFunctions.js')
var eventListeners = require('./eventListeners.js')
var panelFunctions = require('./panelFunctions.js')
var alertFeature = require('./alertFeature.js')

var trailMap = function () {
  var that = {}
  var elementId = 'trailMapLarge'
  var map = L.map(elementId, {
    preferCanvas: true,
    minZoom: 9,
    maxZoom: 18,
    zoomAnimation: true,
    center: Config.mapCenter,
    zoom: Config.defaultZoom
  })
  map.removeControl(map.zoomControl)

  var tangramLayer = Tangram.leafletLayer({
    scene: 'https://map.fpdcc.com/basemap_styles/fpdcc_style.yaml',
    attribution: '<a href="https://mapzen.com/tangram" target="_blank">Tangram</a> | &copy; OSM contributors',
    modifyScrollWheel: false,
    modifyZoomBehavior: false,
    updateWhenIdle: true,
    updateWhenZooming: false,
    maxZoom: 18
  }).addTo(map)

  var myAnalytics = analyticsCode.setup()
  // map.addControl(L.control.zoom({position: 'topright'}))
  var alertFeat = alertFeature(map)
  //var poiSetup = poiFeature.setup(alertFeat)
  var poiFeat = poiFeature.poiFeature(map)
  
  
  var tSegment = trailSegmentFeature(map)
  var activityFeat = activityFeature(map)
  var picnicgroveFeat = picnicgroveFeature(map)
  var tInfo = trailInfo.trailInfo(map)
  
  var filters = filterFunctions(map)
  // var geoFunctions = geolocationFunctions(map, filters, poiFeat)
  var pSetup = panelFunctions.setup(map, filters, poiFeat, tSegment, activityFeat, picnicgroveFeat, tInfo, alertFeat)
  var panel = panelFunctions.panelFuncs(map)
  var eSetup = eventListeners.setup(map, panel, filters, poiFeat, tSegment, activityFeat, picnicgroveFeat, tInfo, alertFeat)
  

  var events = eventListeners.events(map)
  var geoFunctions = geolocationFunctions(map, filters, poiFeat, events, analyticsCode)

  // var lastZoom = null

  var $select = $('.js-example-basic-multiple').selectize({
    placeholder: 'Location or Activity',
    create: true,
    createOnBlur: true,
    persist: false,
    tokenSeparators: [','],
    allowClear: true,
    closeAfterSelect: true,
    allowEmptyOption: true,
    highlight: true,
    plugins: ['remove_button'],
    dropdownDirection: 'auto',
    // onItemAdd: function() {
    //   setTimeout(function() {
    //     console.log("[selectize] onItemAdd trigger");
    //     this.blur();
    //     this.close();
    //   }.bind(this), 200)
    // },
    onChange: function () {
      setTimeout(function () {
        console.log('[selectize] onItemRemove trigger')
        this.blur()
        this.close()
      }.bind(this), 200)
    }
  })

  // $('.closeDetail').click(events.closeDetailPanel) // .click(readdSearchURL)
  $('.fpccSearchbox').change(function (e) { that.processSearch(e) })
  $('#fpccSearchButton').on(Config.listenType, that.processSearch)

  // $('.usePoi').on(Config.listenType, that.testClick)

  map.on('zoomend', function (e) {
    // console.log('zoomend start ' + map.getZoom())
    // var zoomLevel = map.getZoom()
    // lastZoom = zoomLevel
    console.log('zoomend end ' + map.getZoom())
  })

  map.on('moveend', function (e) {

    if (Config.isEdge) {
      // console.log('isEdge')
      $('.useMapIcon').off()
      $('.useMapIcon').on(Config.listenType, events.edgeClick)
    }
    console.log('moveend end ')
  })

  map.on('popupopen', function popupOpenHandler (e) {
    $('.trailhead-trailname').on(Config.listenType, events.poiPopupTrailClick) // Open the detail panel!
    $('.popupTrailheadNames').on(Config.listenType, events.poiPopupNameClick)
    $('.trail-popup-line.trail-subsystem').on(Config.listenType, events.trailPopupNameClick)
  })

  map.on('baselayerchange', function (event) {
    console.log(event.name)
    analyticsCode.trackClickEventWithGA('Layer', 'Change', event.name)
 });

  var ccImagery = esri.imageMapLayer({
    url: 'https://gisimageserver.cookcountyil.gov/arcgis/rest/services/Cook2017/ImageServer/',
    attribution: 'Cook County GIS',
    //minZoom: 14,
    maxZoom: 18,
    compressionQuality: 50
  })

  

  var baseMaps = {
    'Streets': tangramLayer,
    'Satellite': ccImagery
  }

  L.control.scale({maxWidth: 300, position: 'bottomright'}).addTo(map)
  L.control.layers(baseMaps, null, {collapsed: false, position: 'bottomright'}).addTo(map)

  var segmentsDownloadedAndInfoReady = $.when(tSegment.dataDownloaded, tInfo.trailInfoCreated)
  var poiAndTrailInfoCreated = $.when(poiFeat.originalPoisCreated, tInfo.trailInfoCreated)
  var poiSegmentsReady = $.when(poiFeat.originalPoiInfoAdded, tSegment.segmentsCreated)
  var activitiesReady = $.when(activityFeat.originalActivitiesCreated)
  var picnicgrovesReady = $.when(picnicgroveFeat.originalPicnicgrovesCreated)
  var geoSetupAndAlertsReady = $.when(alertFeat.alertsCreated, geoFunctions.geoSetupDone)
  segmentsDownloadedAndInfoReady.done(function () {
    console.log('filters.current = ' + filters.current)
    tSegment.makeSegmentTrailSubsystemObject(tInfo.originalTrailInfo)
    
  })
  poiAndTrailInfoCreated.done(function () {
    poiFeat.addTrailInfo(tInfo.originalTrailInfo)
    console.log('filters.current = ' + filters.current)
  })

  $.address.autoUpdate(0)
  $.address.externalChange(function (event) {
    console.log('[address] externalChange event = ' + event.parameters)
    var searchTerm = filters.addressChange()
    poiSegmentsReady.done(function () {
      if (!searchTerm) {
        console.log('[externalChange] no searchTerm')
        var fitToBounds = true
        var whatBounds = 'all'
        if (panel.setSmall()) {
          whatBounds = ''
        }
        var openResults = true
        geoSetupAndAlertsReady.done(function () {
          if (filters.current.poi) {
            events.trailDivWork(null, filters.current.poi)
            panel.toggleDetailPanel('open')
            fitToBounds = false
            openResults = false
          } else if (filters.current.trail) {
            events.trailDivWork(filters.current.trail, null)
            panel.toggleDetailPanel('open')
            fitToBounds = false
            openResults = false
          }
          if (!poiFeat.filteredPoisFeatureGroup) {
            filterAll(fitToBounds, openResults, whatBounds)
          }
        })
      }
    })
  })

  var filterAll = function (fitToBounds, openResults, whatBounds) {
    console.log('[filterAll] start')
    $('.loader').show()
    poiSegmentsReady.done(function () {
      // console.log('[$.when readyToFilter] start at: ' + performance.now())
      geoFunctions.geoSetupDone.done(function () {
        // console.log('[filterAll] geoSetupDone at ' + performance.now())
        poiFeat.filterPoi(filters, tInfo, alertFeat)
        tInfo.addFilterAlerts(filters, alertFeat)
        events.makeResults(poiFeat, tInfo, filters, openResults)
        tSegment.filterSegments(tInfo.filteredSystemNames)
        activitiesReady.done(function () {
          activityFeat.filterActivity(poiFeat.filteredPoisArray)
        })
        console.log('[filterAll] about to makeresults at ' + performance.now())
        if (poiFeat.filteredPoisFeatureGroup) {
          if (fitToBounds) {
            var zoomFeatureGroupBounds = poiFeat.filteredPoisFeatureGroup.getBounds()
            if (whatBounds !== 'all') {
              var zoomFeatureArray = poiFeat.filteredPoisArray.slice(0, 10)
              if (filters.current.searchLocation) {
                console.log('[filterAll] if filters.current.searchLocation = ' + filters.current.searchLocation)
                zoomFeatureArray.push(new L.marker(filters.current.searchLocation))
                var zoomFeatureGroup = new L.FeatureGroup(zoomFeatureArray)
                zoomFeatureGroupBounds = zoomFeatureGroup.getBounds()
              } else if (filters.current.userLocation) {
                console.log('[filterAll] if filters.current.userLocation')
                var zoomFeatureGroup = new L.FeatureGroup(zoomFeatureArray)
                zoomFeatureGroupBounds = zoomFeatureGroup.getBounds()
              }
            }
            map.fitBounds(zoomFeatureGroupBounds, {
              paddingTopLeft: panel.padding,
              paddingBottomRight: panel.paddingRight
            })
          }
          poiFeat.filteredPoisFeatureGroup.addTo(map)
          // console.log('isEdge? = ' + Config.isEdge)
        }
        if (activityFeat.filteredFG) {
          activityFeat.filteredFG.addTo(map)
        }
        if (tSegment.filteredFG && filters.current.trailOnMap) {
          console.log("about to add segments to map")
          tSegment.filteredFG.addTo(map)
        }
        // events.addEdgeEventHandlers()
      })
    })
    $('.loader').hide()
  }

  that.processSearch = function (e) {
    // $("#fpccSearchResults").html(loaderDiv)
    var $currentTarget = $(e.currentTarget)
    console.log('[processSearch]')
    var currentUIFilterState
    var searchKeyTimeout
    currentUIFilterState = $('#desktop .fpccSearchbox').val()
    console.log('[processSearch] currentUIFilterState= ' + currentUIFilterState)
    analyticsCode.trackClickEventWithGA('Search', 'Begin', currentUIFilterState)
    filters.setCurrent(currentUIFilterState)
    var openResults = true
    if (filters.current.fromURL && (filters.current.poi || filters.current.trail)) {
      openResults = false
    } else {
      events.closeDetailPanel()
      // panel.addSearchURL()
    }
    filters.current.fromURL = false
    filterAll(true, openResults)
  }

  that.fetchData = function () {
    geoFunctions.setupGeolocation()
    tSegment.fetchTrailSegments()
    poiFeat.fetchPois()
    tInfo.fetchTrailInfo()
    activityFeat.fetchActivities()
    picnicgroveFeat.fetchPicnicgroves()
    alertFeat.fetchAlerts()
  }

  // $('a').click(function () {
  //   var $a = $(this)
  //   var href = $a.attr('href')
  //   var datasource = $a.attr('data-source')
  //   var datatrail = $a.attr('data-trailname')
  //   var datapoi = $a.attr('data-trailheadName')
  //   console.log('href = ' + href)
  //   console.log('datasource = ' + datasource)
  //   console.log('datatrail = ' + datatrail)
  //   console.log('datapoi = ' + datapoi)
  // })

  return that
}

module.exports = trailMap
