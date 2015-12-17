var $ = require('jquery');
var L = require('leaflet');
var Search = require('cdb/geo/ui/search');
var NOKIA  = require('cdb/geo/geocoder/nokia-geocoder');
var Map = require('cdb/geo/map');
var Template = require('cdb/core/template');
var LeafletMapView = require('cdb/geo/leaflet/leaflet-map-view');

describe('cdb/geo/ui/search', function() {

  beforeEach(function() {
    this.$el = $("<div>")
      .attr('id', 'map')
      .height(500)
      .width(500);
    $('body').append(this.$el);
    this.map = new Map();
    var template = Template.compile(
      '\
        <form>\
          <span class="loader"></span>\
          <input type="text" class="text" value="" />\
          <input type="submit" class="submit" value="" />\
        </form>\
      ',
      'mustache'
    );
    this.mapView = new LeafletMapView({
      el: this.$el,
      map: this.map
    });

    this.view = new Search({
      template: template,
      model: this.map,
      mapView: this.mapView
    });
    this.view.render();
  });

  it('should render properly', function() {
    expect(this.view.$('form').length).toBe(1);
    expect(this.view.$('input[type="text"]').length).toBe(1);
    expect(this.view.$('input[type="submit"]').length).toBe(1);
    expect(this.view.$('span.loader').length).toBe(1);
  });

  describe('onSubmit', function() {
    beforeEach(function(){
      var self = this;
      this.result = {
        lat: 43.0,
        lon: -3.0,
        boundingbox: {
          south: 6.0,
          north: 4.0,
          west: 6.0,
          east: 4.0
        },
        type: undefined
      };
      NOKIA.geocode = function(address, callback) {
        callback([ self.result ]);
      };

      this.view.$('input.text').val('Madrid, Spain');
    });

    it('should search with geocoder when form is submit', function() {
      spyOn(NOKIA, 'geocode');
      this.view.$('form').submit();
      expect(NOKIA.geocode).toHaveBeenCalled();
    });

    it('should change map center when geocoder returns any result', function() {
      var onBoundsChanged = jasmine.createSpy("onBoundsChange");
      this.map.bind('change:view_bounds_sw', onBoundsChanged, this.view);
      this.view.$('form').submit();
      expect(onBoundsChanged).toHaveBeenCalled();
      this.map.unbind('change:view_bounds_sw', onBoundsChanged, this.view);
    });

    it('should center map to lat,lon when bbox is not defined', function() {
      this.result = {
        lat: 43.0,
        lon: -3.0
      }
      this.view.$('form').submit();
      var center = this.map.get('center');
      expect(center[0]).toBe(43.0);
      expect(center[1]).toBe(-3.0);
    });

    it('should center map whith bbox when it is defined', function() {
      this.view.$('form').submit();
      var ne = this.map.get('view_bounds_ne');
      var sw = this.map.get('view_bounds_sw');
      expect(ne[0].toFixed(0)).toBe('6');
      expect(ne[1].toFixed(0)).toBe('6');
      expect(sw[0].toFixed(0)).toBe('4');
      expect(sw[1].toFixed(0)).toBe('4');
      var center = this.map.get('center');
      expect(center[0]).not.toBe(43.0);
      expect(center[1]).not.toBe(-3.0);
    });

    describe('result zoom', function() {

      it('should zoom to 18 when search result is building type', function() {
        this.result = {
          lat: 43.0,
          lon: -3.0,
          type: 'building'
        };
        this.view.$('form').submit();
        expect(this.map.get('zoom')).toBe(18);
      });

      it('should zoom to 15 when search result is building type', function() {
        this.result = {
          lat: 43.0,
          lon: -3.0,
          type: 'postal-area'
        };
        this.view.$('form').submit();
        expect(this.map.get('zoom')).toBe(15);
      });

      it('should zoom to 12 when search result is unknown type', function() {
        this.result = {
          lat: 43.0,
          lon: -3.0,
          type: 'whatever'
        };
        this.view.$('form').submit();
        expect(this.map.get('zoom')).toBe(12);
      });
    });

    describe('searchPin', function() {
      beforeEach(function() {
        this.view.options.searchPin = true;
        this.view.$('form').submit();
      });

      it('should add a pin and an infowindow when search is completed', function() {
        expect(this.view._searchPin).toBeDefined();
        expect(this.view._searchInfowindow).toBeDefined();
      });

      it('should place pin in the lat,lon if it is provided', function() {
        this.result = {
          lat: 43.0,
          lon: -3.0
        };
        var center = this.view._searchPin.model.get('geojson').coordinates;
        expect(center[0]).toBe(-3.0);
        expect(center[1]).toBe(43.0);
      });

      it('should place pin in the middle of the bbox if lat,lon is not provided', function() {
        this.result = {
          boundingbox: {
            south: 6.0,
            north: 4.0,
            west: 6.0,
            east: 4.0
          }
        };
        this.view.$('form').submit();
        var center = this.view._searchPin.model.get('geojson').coordinates;
        expect(center[0]).toBe(5.0);
        expect(center[1]).toBe(5.0);
      });

      it('should display address in the search infowindow', function() {
        expect(this.view._searchInfowindow.$('.Cdb-infowindow-title').text()).toBe('Madrid, Spain');
      });

      it('should destroy/hide search pin when map is clicked', function(done) {
        jasmine.clock().install();

        var view = this.view;
        expect(view._searchPin).toBeDefined();
        expect(view._searchInfowindow).toBeDefined();
        this.mapView.trigger('click');
        setTimeout(function() {
          expect(view._searchPin).toBeUndefined();
          expect(view._searchInfowindow).toBeUndefined();
          done();
        }, 1500);

        jasmine.clock().tick(2000);
      });
    });
  });

  afterEach(function() {
    this.$el.remove();
    jasmine.clock().uninstall();
  })

});