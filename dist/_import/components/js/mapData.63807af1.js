import * as d3Base from "../../../_npm/d3@7.9.0/7055d4c5.js";
import * as d3GeoProjection from "../../../_npm/d3-geo-projection@4.0.0/4d7a0412.js";
import * as d3GeoPolygon from "../../../_npm/d3-geo-polygon@2.0.1/d02baae9.js";
import * as d3GeoScaleBar from "../../../_npm/d3-geo-scale-bar@1.2.5/273332d7.js";
import * as d3Array from "../../../_npm/d3-array@3.2.4/e95f898e.js";
import {FileAttachment} from "../../../_observablehq/stdlib.2229c972.js";
import queryOverpass from "../../../_npm/query-overpass@1.5.5/69ce1f03.js";
import {default as proj4} from "../../../_npm/proj4@2.7.5/034b033c.js";
import * as turf from "../../../_npm/@turf/turf@7.2.0/430a7ea5.js";
import geojsonrewind from "../../../_npm/geojson-rewind@0.3.1/7d5b99d1.js";
import * as topoClient from "../../../_npm/topojson-client@3.1.0/44d97fcb.js";
import * as topoSimplify from "../../../_npm/topojson-simplify@3.0.3/fd9926cb.js";
import * as topoSever from "../../../_npm/topojson-server@3.0.1/470bdfd4.js";

const e = await FileAttachment("../../../components/js/e.geojson", import.meta.url).json()
const n = await FileAttachment("../../../components/js/n.geojson", import.meta.url).json()
const s = await FileAttachment("../../../components/js/s.geojson", import.meta.url).json()
const w = await FileAttachment("../../../components/js/w.geojson", import.meta.url).json()

const c = await FileAttachment("../../../components/js/ne_10m_admin_0_countries_usa (1) (1).json", import.meta.url).json();
const p = await FileAttachment("../../../components/js/ne_10m_populated_places.json", import.meta.url).json();
const pr = await FileAttachment("../../../components/js/ne_10m_admin_1_states_provinces.json", import.meta.url).json();
const lakes = await FileAttachment("../../../components/js/ne_10m_lakes (1).json", import.meta.url).json();
const oceans = await FileAttachment("../../../components/js/ocean.json", import.meta.url).json();
const disputed = await FileAttachment("../../../components/js/disputed_cfr.json", import.meta.url).json();
const coastlines = await FileAttachment("../../../components/js/ne_10m_coastline.json", import.meta.url).json();
const ls_admin0_innerlines = await FileAttachment("../../../components/js/ls_admin0_innerlines.json", import.meta.url).json()
const ls_admin0_polys = await FileAttachment("../../../components/js/ls_admin0_polys.json", import.meta.url).json()
const ls_admin1_polys = await FileAttachment("../../../components/js/ls_admin1_polys.json", import.meta.url).json()
const ls_land = await FileAttachment("../../../components/js/ls_land.json", import.meta.url).json()
const ls_admin1_innerlines = await FileAttachment("../../../components/js/ls_admin1_innerlines.json", import.meta.url).json()
const ls_rivers = await FileAttachment("../../../components/js/ls_rivers.json", import.meta.url).json()
const ls_waterbodies = await FileAttachment("../../../components/js/ls_waterbodies.json", import.meta.url).json()
const ss_admin0_innerlines = await FileAttachment("../../../components/js/ss_admin0_innerlines.json", import.meta.url).json()
const ss_admin0_polys = await FileAttachment("../../../components/js/ss_admin0_polys.json", import.meta.url).json()
const ss_land = await FileAttachment("../../../components/js/ss_land.json", import.meta.url).json()
const ss_rivers = await FileAttachment("../../../components/js/ss_rivers.json", import.meta.url).json()
const ss_waterbodies = await FileAttachment("../../../components/js/ss_waterbodies.json", import.meta.url).json()

const d3 = Object.assign({}, 
    d3Base, 
    d3GeoProjection, 
    d3GeoPolygon, 
    d3GeoScaleBar,
    d3Array
);

const topojson = Object.assign({}, 
    topoClient, 
    topoSimplify, 
    topoSever
);

const countries = topojson.feature(await c,c.objects.ne_10m_admin_0_countries_usa).features

export class Mapa {
constructor(
    props = {
      width: null,
      height: null,
      bounds: null,
      clipping: null,
      projection: null,
      rotation: null,
      basemap: null,
      layer: {
        points: { show: false, data: null },
        polys: { show: false, data: null },
        tiles: { show: false, data: null },
        grids: { show: false, data: null }
      },
      scalebar: null,
      label: null,
      style: null,
      graphic: null
    }
  ) {
    this.width = props.width ? props.width : defaultSettings.width;
    this.height = props.height ? props.height : defaultSettings.height;
    this.basemap = props.basemap ? props.basemap : defaultSettings.basemap;
    this.projection = props.projection
      ? props.projection
      : defaultSettings.projection;
    this.rotation = props.rotation ? props.rotation : defaultSettings.rotation;
    this.layer = props.layer ? props.layer : defaultSettings.layer;
    this.scalebar = props.scalebar ? props.scalebar : defaultSettings.scalebar;
    this.bounds = props.bounds ? props.bounds : defaultSettings.bounds;
    this.clipping = props.clipping ? props.clipping : defaultSettings.clipping;
    this.label = props.label ? props.label : defaultSettings.label;
    this.graphic = props.graphic ? props.graphic : defaultSettings.graphic;
  }
  get render() {
    class Layer {
      constructor(
        props = {
          geometry: null,
          style: null,
          group: null,
          path: null,
          type: null,
          scale: null
        }
      ) {
        this.geometry = props.geometry ? props.geometry : null;
        this.filter = props.filter
          ? props.filter
          : { show: null, key: null, value: null };
        this.style = props.style
          ? props.style
          : {
              stroke: null,
              "stroke-dasharray": null,
              "stroke-dashoffset": null,
              "stroke-linecap": null,
              "stroke-linejoin": null,
              "stroke-miterlimit": null,
              "stroke-opacity": null,
              "stroke-width": null,
              fill: null,
              radius: null,
              "fill-opacity": null,
              opacity: null,
              type: null
            };
        this.group = props.group ? props.group : null;
        this.path = props.path;
        this.type = props.type ? props.type : null;
        this.scale = props.scale ? props.scale : null;
      }
      get add() {
        let filter = this.filter;
        let group = this.group;
        let geometry = this.geometry;
        let style = this.style;
        let path = this.path;
        let layer = this.layer;
        let data = null;
        let scale = this.scale;
        let type = this.type;
        if (this.type == "Point") {
          return group
            .append("g")
            .selectAll("circle")
            .data(geometry)
            .enter()
            .append("circle")
            .attr("cx", (d) => projection(d.geometry.coordinates)[0])
            .attr("cy", (d) => projection(d.geometry.coordinates)[1])
            .attr("r", this.style.radius ?? "4") // Set the radius here
            .attr("stroke-opacity", this.style["stroke-opacity"] ?? "1")
            .attr("stroke", this.style["stroke"] ?? "black")
            .attr("stroke-width", this.style["stroke-width"] ?? "none")
            .attr("fill", this.style.fill ?? "none")
            .attr("fill-opacity", this.style["fill-opacity"] ?? "1");
        } else if (this.geometry.type == "Topology") {
          data = topojson.feature(
            geometry,
            geometry.objects[Object.keys(geometry.objects)[0]] // 😅
          ).features;

          if (filter.show) {
            data = data.filter(function (d) {
              console.log(filter.key, d.properties, d.properties[filter.key]);
              if (d.properties[filter.key] == filter.value) {
                return d;
              }
            });

            //console.log(data.length);
          }
          return group
            .append("g")
            .selectAll("path")
            .data(data)
            .enter()
            .append("path")
            .attr("d", path)
            .attr("stroke", this.style.stroke ? this.style.stroke : "none")
            .attr(
              "stroke-dasharray",
              this.style["stroke-dasharray"]
                ? this.style["stroke-dasharray"]
                : "none"
            )
            .attr(
              "stroke-dashoffset",
              this.style["stroke-dashoffset"]
                ? this.style["stroke-dashoffset"]
                : "none"
            )
            .attr(
              "stroke-linecap",
              this.style["stroke-linecap"]
                ? this.style["stroke-linecap"]
                : "round"
            )
            .attr(
              "stroke-linejoin",
              this.style["stroke-linejoin"]
                ? this.style["stroke-linejoin"]
                : "round"
            )
            .attr(
              "stroke-miterlimit",
              this.style["stroke-miterlimit"]
                ? this.style["stroke-miterlimit"]
                : "4"
            )
            .attr(
              "stroke-opacity",
              this.style["stroke-opacity"] ? this.style["stroke-opacity"] : "1"
            )
            .attr(
              "stroke-width",
              this.style["stroke-width"] ? this.style["stroke-width"] : "none"
            )
            .attr("fill", this.style.fill ? this.style.fill : "none")
            .attr(
              "fill-opacity",
              this.style["fill-opacity"] ? this.style["fill-opacity"] : "1"
            )
            .attr("opacity", this.style.opacity ? this.style.opacity : "1");
        } else {
          if (this.type == "qtree") {
            return group
              .append("g")
              .selectAll("circle")
              .data(geometry)
              .enter()
              .append("circle")
              .attr("cx", (d) => {
                return projection(d.geometry.coordinates)[0];
              })
              .attr("cy", (d) => {
                return projection(d.geometry.coordinates)[1];
              })
              .attr("r", (d) => {
                return scale(d.properties.count);
              })
              .attr("data-count", (d) => {
                return d.properties.count;
              })
              .attr(
                "stroke-opacity",
                this.style["stroke-opacity"]
                  ? this.style["stroke-opacity"]
                  : "1"
              )
              .attr(
                "stroke",
                this.style["stroke"] ? this.style["stroke"] : "black"
              )
              .attr(
                "stroke-width",
                this.style["stroke-width"] ? this.style["stroke-width"] : "none"
              )
              .attr("fill", this.style.fill ? this.style.fill : "none")
              .attr(
                "fill-opacity",
                this.style["fill-opacity"] ? this.style["fill-opacity"] : "1"
              );
          } else {
            return group
              .append("g")
              .selectAll("path")
              .data(geometry)
              .enter()
              .append("path")
              .attr("d", path)
              .attr("stroke", this.style.stroke ? this.style.stroke : "none")
              .attr(
                "stroke-dasharray",
                this.style["stroke-dasharray"]
                  ? this.style["stroke-dasharray"]
                  : "none"
              )
              .attr(
                "stroke-dashoffset",
                this.style["stroke-dashoffset"]
                  ? this.style["stroke-dashoffset"]
                  : "none"
              )
              .attr(
                "stroke-linecap",
                this.style["stroke-linecap"]
                  ? this.style["stroke-linecap"]
                  : "butt"
              )
              .attr(
                "stroke-linejoin",
                this.style["stroke-linejoin"]
                  ? this.style["stroke-linejoin"]
                  : "round"
              )
              .attr(
                "stroke-miterlimit",
                this.style["stroke-miterlimit"]
                  ? this.style["stroke-miterlimit"]
                  : "4"
              )
              .attr(
                "stroke-opacity",
                this.style["stroke-opacity"]
                  ? this.style["stroke-opacity"]
                  : "1"
              )
              .attr(
                "stroke-width",
                this.style["stroke-width"] ? this.style["stroke-width"] : "none"
              )
              .attr("fill", this.style.fill ? this.style.fill : "none")
              .attr(
                "fill-opacity",
                this.style["fill-opacity"] ? this.style["fill-opacity"] : "1"
              )
              .attr("opacity", this.style.opacity ? this.style.opacity : "1");
          }
        }
      }
    }
    let uid = Math.random().toString(36).substr(2, 5);

    let margin = this.clipping.margin;
    let width = this.width;
    let height = this.height;
    let basemap = this.basemap;

    const sphere = { type: "Sphere" };
    const country = this.basemap.land.geometry;

    let projection = this.projection.proj;

    if (this.projection.type == "proj4") {
      function degreesToRadians(degrees) {
        return (degrees * Math.PI) / 180;
      }
      function radiansToDegrees(radians) {
        return (radians * 180) / Math.PI;
      }

      let check = this.projection.proj.split(" ");
      for (let x of ["+x_0=0", "+y_0=0"]) {
        if (check.indexOf(x) == -1) {
          check.push(x);
        }
      }
      projection = check.join(" ");

      let projTarget = proj4(projection);
      let project4 = function (lambda, phi) {
        return projTarget.forward([lambda, phi].map(radiansToDegrees));
      };
      project4.invert = function (x, y) {
        return projTarget.inverse([x, y]).map(degreesToRadians);
      };

      projection = d3
        .geoProjection(project4)
        .fitExtent(
          [
            [0, 0],
            [width, height]
          ],
          this.bounds.feature
        )
        .preclip(d3.geoClipAntimeridian); //
    }

    if (this.projection.type == "raw") {
      projection = this.projection.proj;
    }

    if (this.projection.type == "clip") {
      projection = this.projection.proj.clipAngle(180);
    }

    if (this.projection.type == "custom") {
      projection = this.projection.proj
        .translate(this.projection.translate)
        .scale(this.projection.scale)
        .center(this.projection.center)
        .rotate(this.projection.rotate)
        .tilt(this.projection.tilt)
        .distance(this.projection.distance)
        .clipAngle(this.projection.clipAngle)
        .precision(this.projection.precision);
    }

    if (height == null) {
      const [[x0, y0], [x1, y1]] = d3
        .geoPath(projection.fitWidth(width, sphere))
        .bounds(sphere);
      const dy = Math.ceil(y1 - y0),
        l = Math.min(Math.ceil(x1 - x0), dy);
      projection.scale((projection.scale() * (l - 1)) / l).precision(0.2);
      height = dy;
    }

    if (this.projection.fit == "none") {
    }

    if (this.bounds.bounder) {
      projection.fitSize([width, height], this.bounds.feature);
    }

    if (this.projection.fit == "iso2") {
      if (this.bounds.countries.length > 0) {
        let list = this.bounds.countries;
        let filteredCountries = countries.filter(function (d, i) {
          if (list.indexOf(d.properties.ISO_A2) > -1) {
            return d;
          }
        });

        projection.fitSize(
          [width, height],
          turf.featureCollection(filteredCountries)
        );
      }
    }

    if (this.projection.fit == "iso3") {
      if (this.bounds.countries.length > 0) {
        let list = this.bounds.countries;
        let filteredCountries = countries.filter(function (d, i) {
          if (list.indexOf(d.properties.ISO_A3) > -1) {
            return d;
          }
        });

        projection.fitSize(
          [width, height],
          turf.featureCollection(filteredCountries)
        );
      }
    }

    if (this.projection.fit == "size") {
      projection.fitSize([width, height], sphere);
    }
    if (this.projection.fit == "extent") {
      projection.fitExtent(
        [
          [0, 0],
          [width, height]
        ],
        sphere
      );
    }

    if (this.clipping.clip) {
      function viewport() {
        let n = 15;
        let p = -1 * margin;

        return {
          type: "Polygon",
          coordinates: [
            [
              ...Array.from({ length: n }, (_, t) => [
                p + ((width - p * 2) * t) / n,
                p
              ]),
              ...Array.from({ length: n }, (_, t) => [
                width - p,
                ((height - p * 2) * t) / n + p
              ]),
              ...Array.from({ length: n }, (_, t) => [
                p + ((width - p * 2) * (n - t)) / n,
                height - p
              ]),
              ...Array.from({ length: n }, (_, t) => [
                p,
                ((height - p * 2) * (n - t)) / n + p
              ]),
              [p, p]
            ].map((p) => projection.invert(p))
          ]
        };
      }
      let v = {
        type: "Polygon",
        coordinates: [
          viewport().coordinates[0].map(d3.geoRotation(projection.rotate()))
        ]
      };
      let clipPolygon = d3.geoClipPolygon(v);
      projection.preclip(clipPolygon);
    }

    let path = d3.geoPath().projection(projection);

    let rotation = this.rotation.value;
    if (this.rotation.value instanceof Array) {
      rotation = this.rotation.value;
    } else {
      rotation = [this.rotation.value, 0, 0];
    }
    if (this.rotation.rotate) {
      projection.rotate(rotation);
    }

      // Create and setup SVG with UID
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    let layers = this.layers;
    const graphic = d3
      .select(svg)
      .attr("width", width)
      .attr("height", height)
      .attr("id", uid)  // Using the UID as id
      .attr("id", "graphic")
      .attr("vector-effect", "non-scaling-stroke")
      .attr("stroke-linejoin", "round");

    let graster = graphic.append("g").attr("id", "rasterlayer"); //bottom
    let gbasemap = graphic.append("g").attr("id", "basemap");
    let glayer = graphic.append("g").attr("id", "layers");
    let gsymbol = graphic.append("g").attr("id", "symbols");
    let glabel = graphic.append("g").attr("id", "labels");
    let gscalebar = graphic.append("g").attr("id", "scalebar");
    let gannotation = graphic.append("g").attr("id", "annotations"); //top
    let ggrid = graphic.append("g").attr("id", "grid");

    graster.append("g").attr("id", "raster");

    let scalebar = this.scalebar;
    if (scalebar.show) {
      const mapUnits = {
        km: d3.geoScaleKilometers,
        mi: d3.geoScaleMiles,
        ft: d3.geoScaleFeet,
        m: d3.geoScaleMeters,
        kilometers: d3.geoScaleKilometers,
        miles: d3.geoScaleMiles,
        feet: d3.geoScaleFeet,
        meters: d3.geoScaleMeters
      };
      const mapScale = gscalebar
        .append("g")
        .attr(
          "transform",
          `translate(${width - scalebar.position[0]}, ${
            height - scalebar.position[1]
          })`
        );

      var stop = 0;
      var sleft = 0;

      const scaleBarTop = d3
        .geoScaleBar()
        .projection(projection)
        .size([width, height])
        .orient(d3.geoScaleTop)
        .units(mapUnits[scalebar.topUnit])
        .distance(scalebar.topValue)
        .left(sleft)
        .top(stop)
        .label(null)
        .tickPadding(3)
        .tickFormat((d, i, e) =>
          i === e.length - 1 ? `${d} ${scalebar.topUnit}` : d
        )
        .tickValues([0, scalebar.topValue]);

      const scaleBarBottom = d3
        .geoScaleBar()
        .projection(projection)
        .size([width, height])
        .units(mapUnits[scalebar.bottomUnit])
        .orient(d3.geoScaleBottom)
        .distance(scalebar.bottomValue)
        .left(sleft)
        .top(stop)
        .label(null)
        .tickPadding(3)
        .tickFormat((d, i, e) =>
          i === e.length - 1 ? `${d} ${scalebar.bottomUnit}` : d
        )
        .tickValues([0, scalebar.bottomValue]);

      const myscaleTop = mapScale
        .append("g")
        .attr("id", "scalebart")
        .attr("transform", "translate(0, -5)");

      const myscaleBottom = mapScale
        .append("g")
        .attr("id", "scalebarb")
        .attr("transform", "translate(0, 5)");

      myscaleTop.call(scaleBarTop);
      myscaleBottom.call(scaleBarBottom);

      myscaleTop.selectAll("rect").remove();
      myscaleBottom.selectAll("rect").remove();

      myscaleTop.selectAll("path, line").attr("stroke", "#4B535D");
      myscaleBottom.selectAll("path, line").attr("stroke", "#4B535D");

      myscaleTop
        .selectAll(".tick")
        .select("text")
        .attr("text-anchor", "start")
        .attr("dx", function (d, i) {
          if (d < 1) {
            return -3.5;
          } else {
            return -4 * +d.toString().length;
          }
        })
        .attr("font-size", 14)
        .attr("fill", "#4B535D");

      myscaleBottom
        .selectAll(".tick")
        .select("text")
        .attr("text-anchor", "start")
        .attr("dx", function (d, i) {
          if (d < 1) {
            return -3.5;
          } else {
            return -4 * +d.toString().length;
          }
        })
        .attr("font-size", 14)
        .attr("fill", "#4B535D");
    }

    if (basemap.background.show) {
      let globeRect = {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-180, -90],
              [-180, 90],
              [180, 90],
              [180, -90],
              [-180, -90]
            ]
          ]
        }
      };

      gbasemap
        .append("g")
        .attr("id", "background")
        .selectAll("path")
        .data([globeRect])
        .join("path")
        .attr(
          "stroke",
          this.basemap.background.style.stroke
            ? this.basemap.background.style.stroke
            : "none"
        )
        .attr(
          "fill",
          this.basemap.background.style.fill
            ? this.basemap.background.style.fill
            : "none"
        )
        .attr(
          "opacity",
          this.basemap.background.style.opacity
            ? this.basemap.background.style.opacity
            : "1"
        )
        .attr("d", path);
    }
    if (basemap.ocean.show) {
      gbasemap
        .append("g")
        .attr("id", "ocean")
        .selectAll("path")
        .data(oceans)
        .join("path")
        .attr(
          "stroke",
          this.basemap.ocean.style.stroke
            ? this.basemap.ocean.style.stroke
            : "none"
        )
        .attr(
          "fill",
          this.basemap.ocean.style.fill ? this.basemap.ocean.style.fill : "none"
        )
        .attr(
          "opacity",
          this.basemap.ocean.style.opacity
            ? this.basemap.ocean.style.opacity
            : "1"
        )
        .attr("d", path);
    }
    if (basemap.land.show) {
      gbasemap
        .append("g")
        .attr("id", "land")
        .selectAll("path")
        .data(countries)
        .join("path")
        .attr(
          "stroke",
          this.basemap.land.style.stroke
            ? this.basemap.land.style.stroke
            : "none"
        )
        .attr(
          "stroke-width",
          this.basemap.land.style["stroke-width"]
            ? this.basemap.land.style["stroke-width"]
            : "none"
        )
        .attr(
          "fill",
          this.basemap.land.style.fill ? this.basemap.land.style.fill : "none"
        )
        .attr(
          "opacity",
          this.basemap.land.style.opacity
            ? this.basemap.land.style.opacity
            : "1"
        )
        .attr("d", path)
        .on("click", mouseClick);

      function mouseClick() {
        let tar = d3.select(this).data()[0];
        console.log(tar.properties.NAME);
      }
    }
    if (basemap.border.show) {
      gbasemap
        .append("path")
        .attr("id", "border")
        .datum(
          topojson.mesh(
            c,
            c.objects.ne_10m_admin_0_countries_usa,
            function (a, b) {
              return a !== b;
            }
          )
        )
        .attr(
          "stroke",
          this.basemap.border.style.stroke
            ? this.basemap.border.style.stroke
            : "none"
        )
        .attr(
          "stroke-width",
          this.basemap.border.style["stroke-width"]
            ? this.basemap.border.style["stroke-width"]
            : "1"
        )
        .attr("fill", "none")
        .attr(
          "opacity",
          this.basemap.border.style.opacity
            ? this.basemap.border.style.opacity
            : "1"
        )
        .attr("d", path);
    }
    if (basemap.coastline.show) {
      gbasemap
        .append("g")
        .attr("id", "coastline")
        .selectAll("path")
        .data(coastlines)
        .join("path")
        .attr(
          "stroke",
          this.basemap.coastline.style.stroke
            ? this.basemap.coastline.style.stroke
            : "none"
        )
        .attr(
          "stroke-width",
          this.basemap.coastline.style["stroke-width"]
            ? this.basemap.coastline.style["stroke-width"]
            : "none"
        )
        .attr("fill", "none")
        .attr(
          "opacity",
          this.basemap.coastline.style.opacity
            ? this.basemap.coastline.style.opacity
            : "1"
        )
        .attr("d", path);
    }
    if (basemap.lake.show) {
      gbasemap
        .append("g")
        .attr("id", "lakes")
        .selectAll("path")
        .data(lakes)
        .join("path")
        .attr("stroke", "none")
        .attr(
          "stroke-width",
          this.basemap.lake.style["stroke-width"]
            ? this.basemap.lake.style["stroke-width"]
            : "none"
        )
        .attr(
          "fill",
          this.basemap.lake.style.fill ? this.basemap.lake.style.fill : "none"
        )
        .attr(
          "opacity",
          this.basemap.lake.style.opacity
            ? this.basemap.lake.style.opacity
            : "1"
        )
        .attr("d", path);
    }

    if (this.layer.polys.show) {
      for (let l in this.layer.polys.data) {
        console.log(this.layer.polys.data[l]);
        new Layer({
          geometry: this.layer.polys.data[l].geometry,
          group: glayer,
          style: this.layer.polys.data[l].style,
          type: this.layer.polys.data[l].style.type
            ? this.layer.polys.data[l].style.type
            : "null",
          path: path,
          filter: this.layer.polys.data[l].filter
            ? this.layer.polys.data[l].filter
            : { show: false }
        }).add;
      }
    }

    if (this.layer.tiles.show) {
      let filter = null;
      let url = null;
      let format = null;
      let tiles = this.layer.tiles.data;
      for (let t in tiles) {
        if (tiles[t].show) {
          let raster = graster
            .append("g")
            .attr("id", "tiles-" + uid + "-" + tiles[t].id);

          if (typeof tiles[t].filter !== undefined) {
            filter = tiles[t].filter;
          }
          url = tiles[t].url ? tiles[t].url : null;
          format = tiles[t].format ? tiles[t].format : null;
          let zoom = tiles[t].zoom ? tiles[t].zoom : null;
          let tileset = getTiles(tiles[t].type, zoom, filter);
          let slippy = geoTile().size([width, height]).tileSet(tileset);

          if (typeof tiles[t].delta == "number") {
            slippy = geoTile(tiles[t].delta)
              .size([width, height])
              .tileSet(tileset);
          }

          slippy.projection(projection);
          raster.call(slippy.tile);
        }
      }
      //all the tile credit goes to Andrew Reid, 2018
      function getTiles(type, zoom, filter) {
        let tileset = "";
        if (type == "url") {
          tileset = {
            type: "tileset",
            attribution: "",
            source: function (d) {
              return url + "/" + d.z + "/" + d.x + "/" + d.y + "." + format;
            }
          };
        }
        if (type.split("-")[0] == "custom") {
          let dir = type.split("-");
          dir = dir.join("/");
          //console.log(dir);
          tileset = {
            type: "tileset",
            attribution: "",
            source: function (d) {
              if (zoom) {
                d.z = zoom;
              } else {
                d.z = d.z;
              }
              return (
                "https://raw.githubusercontent.com/mbrickmaps/" +
                dir.replace("custom", "") +
                "/" +
                d.z +
                "/" +
                d.x +
                "/" +
                ((1 << d.z) - d.y - 1) +
                ".png"
              );
            }
          };
        }
        if (type == "debug") {
          tileset = {
            source: function (d) {
              return `https://dummyimage.com/256x256/a8a8a8/0011ff.png&text=${
                d.z
              }/${d.x}/${(1 << d.z) - d.y - 1}`;
            }
          };
        }
        return tileset;
      }
      function geoTile(delta) {
        const tau = Math.PI * 2;
        var lim = 85.05113;
        var tileSize = 256;

        var w = width;
        var h = height;

        var pk = w / tau;
        var pc = [0, 0];
        var pr = 0;

        var tk = 2;
        var tx = w / 2;
        var ty = h / 2;

        var p = d3.geoMercator().scale(pk).center(pc);

        var z0 = 0;
        var z1 = 15;
        var extent = function () {
          return { left: -179.99999, top: lim, right: 179.9999, bottom: -lim };
        };
        var wrap = true;

        var tileWidth = 256;
        var tileHeight = 256;
        var xyz = true;

        var source = function (d) {
          return (
            "http://" +
            "abc"[d.y % 3] +
            ".tile.openstreetmap.org/" +
            d.z +
            "/" +
            d.x +
            "/" +
            d.y +
            ".png"
          );
        };
        var a = "Tiles © OpenStreetMap contributors";
        geoTile.xyz = function (_) {
          return arguments.length ? ((xyz = _), geoTile) : xyz;
        };

        function geoTile(_) {
          return p(_);
        }

        geoTile.width = function (_) {
          return arguments.length ? ((w = _), geoTile) : w;
        };
        geoTile.height = function (_) {
          return arguments.length ? ((h = _), geoTile) : h;
        };
        geoTile.size = function (_) {
          if (arguments.length) {
            _ instanceof d3.selection
              ? ((w = _.attr("width")),
                (h = _.attr("height")),
                (tx = w / 2),
                (ty = h / 2))
              : ((w = _[0]), (h = _[1]));
            return geoTile;
          } else return [w, h];
        };
        geoTile.source = function (_) {
          return arguments.length ? ((source = _), geoTile) : source;
        };
        geoTile.projection = function (_) {
          return arguments.length
            ? ((p = _), (pk = _.scale()), (pc = _.center()), geoTile)
            : p;
        };
        geoTile.attribution = function (_) {
          return arguments.length ? ((a = _), geoTile) : a;
        };
        geoTile.wrap = function (_) {
          return arguments.length ? ((wrap = _), geoTile) : wrap;
        };
        geoTile.tileWidth = function (_) {};
        geoTile.tileHeight = function (_) {};

        geoTile.invert = function (_) {
          return p.invert(_);
        };
        geoTile.center = function (_) {
          var rotate = d3.geoRotation(p.rotate());
          if (arguments.length) {
            pc = rotate(_);
            p.center(pc);
            return geoTile;
          } else {
            return rotate.invert(pc);
          }
        };
        geoTile.scale = function (_) {
          return arguments.length ? ((pk = _), p.scale(pk), geoTile) : pk;
        };
        geoTile.rotate = function (_) {
          return arguments.length ? ((pr = _), p.rotate([pr, 0]), geoTile) : pr;
        };
        geoTile.fit = function (_) {
          return arguments.length
            ? (p.fitSize([w, h], _),
              (tx = p.translate()[0]),
              (ty = p.translate()[1]),
              (pk = p.scale()),
              geoTile)
            : "n/a";
        };
        geoTile.fitMargin = function (m, f) {
          return arguments.length > 1
            ? (p.fitExtent(
                [
                  [m, m],
                  [w - m, h - m]
                ],
                f
              ),
              (tx = p.translate()[0]),
              (ty = p.translate()[1]),
              (pk = p.scale()),
              geoTile)
            : "n/a";
        };

        geoTile.zoomScale = function (_) {
          return arguments.length ? ((tk = _), p.scale(pk * tk), geoTile) : tk;
        };
        geoTile.zoomTranslate = function (_) {
          return arguments.length
            ? ((tx = _[0]), (ty = _[1]), p.translate([tx, ty]), geoTile)
            : [tx, ty];
        };
        geoTile.zoomIdentity = function () {
          return d3.zoomIdentity.translate(tx, ty).scale(tk).translate(0, 0);
        };
        geoTile.zoomTransform = function (t) {
          return (
            (tx = t.x),
            (ty = t.y),
            (tk = t.k),
            p.translate([tx, ty]),
            p.scale(pk * tk),
            geoTile
          );
        };

        geoTile.tileDepth = function () {
          var a = [w / 2 - 1, h / 2];
          var b = [w / 2 + 1, h / 2];
          var dx = d3.geoDistance(p.invert(a), p.invert(b));
          var scale = ((20 / dx) * tk * pk) / 200;
          var z = Math.max(Math.log(scale) / Math.LN2 - 8, 2);
          z = Math.min(z, 15) | 0;
          var maxTiles = (w * h) / 256 / 128;

          while (d3quadTiles(p, z).length > maxTiles) {
            z--;
          }

          if (delta) {
            z = z + delta;
          }
          return z;
        };
        geoTile.zoomTranslateExtent = function (_) {
          var e = extent();
          if (arguments.length) {
            e.left = _[0][0];
            e.top = _[0][1];
            e.right = _[1][0];
            e.bottom = _[1][1];
            return geoTile;
          } else {
            var x0 = p([e.left - pr, e.top])[0] - tx;
            var y0 = p([e.left - pr, e.top])[1] - ty;
            var x1 = p([e.right - pr, e.bottom])[0] - tx;
            var y1 = p([e.right - pr, e.bottom])[1] - ty;
            return [
              [x0, y0],
              [x1, y1]
            ];
          }
        };
        geoTile.zoomTranslateConstrain = function () {
          var e = extent();
          e.left = p.invert([0, 0])[0];
          e.top = p.invert([0, 0])[1];
          e.right = p.invert([w, h])[0];
          e.bottom = p.invert([w, h])[1];

          var x0 = p([e.left - pr, e.top])[0] - tx;
          var y0 = p([e.left - pr, e.top])[1] - ty;
          var x1 = p([e.right - pr, e.bottom])[0] - tx;
          var y1 = p([e.right - pr, e.bottom])[1] - ty;
          return [
            [x0, y0],
            [x1, y1]
          ];
        };

        geoTile.tiles = function () {
          var z = geoTile.tileDepth();
          // var e = p.clipExtent();
          var set = d3quadTiles(p, Math.max(z0, Math.min(z, z1)));
          //p.clipExtent(e);

          return set;
        };
        geoTile.tile = function (g) {
          let uid = g.attr("id").split("-")[1];
          let type = g.attr("id").split("-")[2];

          var path = d3.geoPath(p);

          var tile = g.selectAll("tiles").data(geoTile.tiles());

          var enter = tile
            .enter()
            .append("image")
            .attr("class", "tile")
            .attr("id", function (d) {
              return "tile-" + type + "-" + uid + "-" + d.key.join("-");
            })
            .each(function (d) {
              var k = d.key;
              var that = this;
              d.image = new Image();
              d.image.crossOrigin = true;
              var location = { x: k[0], y: k[1], z: k[2] };
              d.image.src = source(location);
              d.image.onload = function () {
                onload(d, that);
              };
            });

          function onload(d, that) {
            var mercatorCanvas = d3
              .create("canvas")
              .attr("width", tileWidth)
              .attr("height", tileHeight);

            var mercatorContext = mercatorCanvas.node().getContext("2d");
            mercatorContext.drawImage(d.image, 0, 0, tileWidth, tileHeight);

            var k = d.key;
            var tilesAcross = 1 << k[2];

            var webMercator = d3
              .geoMercator()
              .scale(tilesAcross / Math.PI / 2)
              .translate([0, 0])
              .center([0, 0]);

            var reprojectedTileBounds = path.bounds(d),
              x0 = reprojectedTileBounds[0][0] | 0,
              y0 = reprojectedTileBounds[0][1] | 0,
              x1 = (reprojectedTileBounds[1][0] + 1) | 0,
              y1 = (reprojectedTileBounds[1][1] + 1) | 0;

            var λ0 = (k[0] / tilesAcross) * 360 - 180,
              λ1 = ((k[0] + 1) / tilesAcross) * 360 - 180,
              φ1 = webMercator.invert([0, k[1] - tilesAcross / 2])[1],
              φ0 = webMercator.invert([0, k[1] + 1 - tilesAcross / 2])[1];

            var newCanvas = d3.create("canvas").node();

            (newCanvas.width = x1 - x0), (newCanvas.height = y1 - y0);
            var newContext = newCanvas.getContext("2d");

            if (newCanvas.width > 0 && newCanvas.height > 0) {
              var sourceData = mercatorContext.getImageData(
                  0,
                  0,
                  tileWidth,
                  tileHeight
                ).data,
                target = newContext.createImageData(
                  newCanvas.width,
                  newCanvas.height
                ),
                targetData = target.data;

              for (var y = y0, i = -1; y < y1; ++y) {
                for (var x = x0; x < x1; ++x) {
                  var pt = p.invert([x, y]),
                    λ = pt[0],
                    φ = pt[1];

                  if (λ > λ1 || λ < λ0 || φ > φ1 || φ < φ0) {
                    i += 4;
                    targetData[i] = 0;
                    continue;
                  }
                  var top =
                    ((((tilesAcross + webMercator([0, φ])[1]) * tileHeight) |
                      0) %
                      256 |
                      0) *
                    tileWidth;
                  var q =
                    (((((λ - λ0) / (λ1 - λ0)) * tileWidth) | 0) + top) * 4;

                  let r = sourceData[q];
                  let g = sourceData[++q];
                  let b = sourceData[++q];
                  let a = 255;

                  targetData[++i] = r;
                  targetData[++i] = g;
                  targetData[++i] = b;
                  targetData[++i] = a;
                }
              }

              if (target) newContext.putImageData(target, 0, 0);
            }

            d3.select("#" + d3.select(that).attr("id"))
              .attr("xlink:href", newCanvas.toDataURL())
              .attr("x", x0)
              .attr("width", Math.ceil(newCanvas.width) + 1)
              .attr("height", Math.ceil(newCanvas.height) + 1)
              .attr("y", y0);
          }
        };

        geoTile.tileSet = function (_) {
          if (arguments.length) {
            a = _.attribution ? _.attribution : "Unknown";
            source = _.source
              ? _.source
              : (console.log("no source provided, using osm"),
                (a = "Tiles © OpenStreetMap contributors"),
                function (d) {
                  return (
                    "http://" +
                    "abc"[d.y % 3] +
                    ".tile.openstreetmap.org/" +
                    d.z +
                    "/" +
                    d.x +
                    "/" +
                    d.y +
                    ".png"
                  );
                });
            lim = _.limit ? _.limit : 85.05113;
            tileSize = _.tileSize ? _.tileSize : 256;
            z0 = _.minDepth ? _.minDepth : 1;
            z1 = _.maxDepth ? _.maxDepth : 13;
            wrap = _.wrap ? _.wrap : false;
            xyz = _.xyz ? _.xyz : true;
          }
          return geoTile;
        };
        return geoTile;
      }
      function d3quadTiles(projection, zoom) {
        var tiles = [],
          width = 1 << (zoom = Math.max(0, zoom)),
          step = Math.max(0.2, Math.min(1, zoom * 0.01)),
          invisible,
          precision = projection.precision(),
          stream = projection.precision(960).stream({
            point: function () {
              invisible = false;
            },
            lineStart: noop,
            lineEnd: noop,
            polygonStart: noop,
            polygonEnd: noop
          });

        visit(-180, -180, 180, 180);

        projection.precision(precision);

        return tiles;

        function visit(x1, y1, x2, y2) {
          var w = x2 - x1,
            m1 = mercatorφ(y1),
            m2 = mercatorφ(y2),
            δ = step * w;
          invisible = true;
          stream.polygonStart(), stream.lineStart();
          for (var x = x1; x < x2 + δ / 2 && invisible; x += δ)
            stream.point(x, m1);
          for (var y = m1; (y += δ) < m2 && invisible; ) stream.point(x2, y);
          for (var x = x2; x > x1 - δ / 2 && invisible; x -= δ)
            stream.point(x, m2);
          for (var y = m2; (y -= δ) > m1 && invisible; ) stream.point(x1, y);
          if (invisible) stream.point(x1, m1);
          stream.lineEnd(), stream.polygonEnd();
          if (w <= 360 / width) {
            if (!invisible) {
              tiles.push({
                type: "Polygon",
                coordinates: [
                  d3
                    .range(x1, x2 + δ / 2, δ)
                    .map(function (x) {
                      return [x, y1];
                    })
                    .concat([[x2, 0.5 * (y1 + y2)]])
                    .concat(
                      d3.range(x2, x1 - δ / 2, -δ).map(function (x) {
                        return [x, y2];
                      })
                    )
                    .concat([[x1, 0.5 * (y1 + y2)]])
                    .concat([[x1, y1]])
                    .map(function (d) {
                      return [d[0], mercatorφ(d[1])];
                    })
                ],
                key: [
                  (((180 + x1) / 360) * width) | 0,
                  (((180 + y1) / 360) * width) | 0,
                  zoom
                ],
                centroid: [0.5 * (x1 + x2), 0.5 * (m1 + m2)]
              });
            }
          } else if (!invisible) {
            var x = 0.5 * (x1 + x2),
              y = 0.5 * (y1 + y2);
            visit(x1, y1, x, y);
            visit(x, y1, x2, y);
            visit(x1, y, x, y2);
            visit(x, y, x2, y2);
          }
        }
      }
      function mercatorφ(y) {
        return (Math.atan(Math.exp((-y * Math.PI) / 180)) * 360) / Math.PI - 90;
      }
      function noop() {}
    }
    if (this.layer.grids.show) {
      if (this.layer.grids.data.length > 0) {
        console.log("show grid");
        let grids = this.layer.grids;
        addGrid(grids, width / grids.size, grids.data);
      }
    }

    function addQtree(grids, data) {
      let pointsRaw = data.map((d) => projection(d.geometry.coordinates));

      let quadtree = d3
        .quadtree()
        .extent([
          [-1, -1],
          [width + 1, height + 1]
        ])
        .addAll(pointsRaw);

      function filterByAttribute(attribute, value) {
        const filteredPoints = [];
        quadtree.visit((node, x0, y0, x1, y1) => {
          if (node.length) {
            // if it's an internal node
            const children = node.slice(0, 4); // get the child nodes
            for (const child of children) {
              if (child) {
                // if the child exists
                child.forEach((d) => {
                  if (d[attribute] === value) {
                    // check if the attribute matches the desired value
                    filteredPoints.push(d); // add the point to the filtered array
                  }
                });
              }
            }
          }
        });
        return filteredPoints;
      }

      if (grids.type == "byAttribute") {
        let groupedData = d3.group(
          data,
          (d) => d.properties.data[grids.method.groupBy]
        );
        let attributeValues = Array.from(groupedData.keys());
        let filteredData = attributeValues.map((value) => {
          return {
            group: value,
            geom: groupedData.get(value)
          };
        });
        filteredData.total = filteredData
          .map((d) => d.geom.length)
          .reduce((sum, a) => sum + a, 0);
      }

      function search(quadtree, xmin, ymin, xmax, ymax) {
        const results = [];
        quadtree.visit((node, x1, y1, x2, y2) => {
          if (!node.length) {
            do {
              let d = node.data;
              if (d[0] >= xmin && d[0] < xmax && d[1] >= ymin && d[1] < ymax) {
                results.push(d);
              }
            } while ((node = node.next));
          }
          return x1 >= xmax || y1 >= ymax || x2 < xmin || y2 < ymin;
        });
        return results;
      }

      let clusterPoints = [];
      let clusterRange = width / grids.size;

      for (let x = 0; x <= width; x += clusterRange) {
        for (let y = 0; y <= height; y += clusterRange) {
          let searched = search(
            quadtree,
            x,
            y,
            x + clusterRange,
            y + clusterRange
          );
          let centerPoint = searched.reduce(
            function (prev, current) {
              return [prev[0] + current[0], prev[1] + current[1]];
            },
            [0, 0]
          );

          centerPoint[0] = centerPoint[0] / searched.length;
          centerPoint[1] = centerPoint[1] / searched.length;
          centerPoint.push(searched);
          if (centerPoint[0] && centerPoint[1]) {
            if (grids.method.type == "raw") {
              clusterPoints.push(
                turf.point(
                  projection.invert([centerPoint[0], centerPoint[1]]),
                  {
                    count: searched.length
                  }
                )
              );
            } else {
            }
          } else {
          }
        }
      }

      let pScale = d3
        .scaleSqrt()
        .domain([
          d3.min(clusterPoints, (d) => d.properties.count),
          d3.max(clusterPoints, (d) => d.properties.count)
        ])
        .rangeRound([grids.minSize, grids.maxSize]);
      if (grids.square.show == false) {
        ggrid.remove();
      }
      if (grids.qtree.show == true) {
        function materialize(quadtree) {
          const rects = [];
        }
      }
      new Layer({
        geometry: clusterPoints,
        group: glayer,
        path: path,
        type: grids.type,
        shape: grids.shape,
        style: grids.style,
        scale: pScale //grids.scale
      }).add;
    }

    function addGrid(grids, units, data) {
      if (grids.type == "qtree" || grids.type == "byAttribute") {
        var clusterPoints = [];
        var clusterRange = units;
        for (var x = 0; x <= width; x += clusterRange) {
          for (var y = 0; y <= height; y += clusterRange) {
            ggrid
              .append("rect")
              .attr("x", x)
              .attr("y", y)
              .attr("width", clusterRange)
              .attr("height", clusterRange)
              .attr("class", "ggrid")
              .attr("fill", "red")
              .attr("fill-opacity", 0.2)
              .attr("stroke", "red");
          }
        }

        addQtree(grids, data);
      }
      if (grids.type == "geogrid") {
        addGeoGrid(data, grids);
      }
    }

    function addGeoGrid(data, grids) {
      let points = data.map((d) =>
        turf.point(d.coordinates, { count: d.properties.number })
      );
      let mPoints = turf.featureCollection(points);
      let vPoints = turf.voronoi(mPoints, {
        bbox: turf.bboxPolygon(turf.bbox(mPoints)).bbox
      });
      let bbox = turf.bboxPolygon(turf.bbox(mPoints)).bbox;
      let sPoints = turf.squareGrid(
        [+bbox[0] - 1, +bbox[1] - 1, +bbox[2] + 1, +bbox[3] + 1],
        grids.size,
        {
          units: "degrees"
        }
      );

      let col = turf.collect(sPoints, mPoints, "count", "count");

      let colorScale = d3.scaleSqrt().domain([1, 83]).range(["yellow", "red"]);
      new Layer({
        geometry: col.features,
        group: glayer,
        path: path,
        style: {
          stroke: "none",
          "stroke-dasharray": null,
          "stroke-dashoffset": null,
          "stroke-linecap": null,
          "stroke-linejoin": null,
          "stroke-miterlimit": null,
          "stroke-opacity": null,
          "stroke-width": null,
          fill: function (feature) {
            if (feature.properties.count.length > 0) {
              if (feature.properties.count) {
                let c = feature.properties.count.reduce(function (a, b) {
                  return a + b;
                });
                console.log(c, colorScale(c));
                return colorScale(c);
              }
            } else {
              return "none";
            }
          },
          "fill-opacity": 1,
          opacity: null
        }
      }).add;
    }

    if (this.layer.points.show) {
      if (this.layer.points.show) {
        if (this.layer.points.data.length > 0) {
          let groups = new Set(this.layer.points.data.map((d) => d.type));
          createAnnotationGroups(groups);
          addPoints(this.layer.points.data);
        }
      }

      function createAnnotationGroups(groups) {
        for (let g of groups) {
          gannotation.append("g").attr("id", "type-" + uid + "-" + g);
        }
      }

      function addPoints(data) {
        if (data[0].name !== "") {
          var z = "";
          var labelClass = "v-text-contextual-city";
          var anchorPoint = "start";
          let unit = 0;
          var dx = 0;
          var dy = 0;
          for (z in data) {
            if (data[z].x && data[z].y) {
              data[z].lng = data[z].x;
              data[z].lat = data[z].y;
            }
            if (data[z].latlng) {
              data[z].lng = data[z].latlng.split(",")[0].trim();
              data[z].lat = data[z].latlng.split(",")[1].trim();
            }

            if (data[z].name.length > 0) {
              unit = 4;
              let symbol = "";
              let shape = data[z].shape ? data[z].shape : "circle";
              let adjustLabel = data[z].dir.indexOf("-") > -1 ? true : false;
              let dir = data[z].dir.trim().split("-")[0];
              let type = data[z].type.trim();

              if (["city1", "capital", "Admin-0 capital"].indexOf(type) > -1) {
                labelClass = "v-text-capital-city";
                symbol = "#iconStar";
              }
              if (["city2", "focal", "Admin-1 capital"].indexOf(type) > -1) {
                labelClass = "v-text-focal-city";
                symbol = "#iconCity";
              }
              if (["city3", "context", "Populated place"].indexOf(type) > -1) {
                labelClass = "v-text-contextual-city";
                symbol = "#iconCity";
              }
              if (["custom"].indexOf(type) > -1) {
                shape = data[z].shape ? data[z].shape : "circle";
                labelClass = data[z].group;
              } else {
                labelClass = "v-text-contextual-city";
              }

              if (adjustLabel) {
                unit = data[z].dir.split("-")[1];
              }
              if (["N"].indexOf(dir) > -1) {
                anchorPoint = "middle";
                dx = 0;
                dy = -unit * 2;
              }
              if (["C"].indexOf(dir) > -1) {
                anchorPoint = "middle";
                dx = 0;
                dy = 0;
              }
              if (["NE"].indexOf(dir) > -1) {
                anchorPoint = "start";
                dx = unit + 5;
                dy = -unit;
              }
              if (["E"].indexOf(dir) > -1) {
                anchorPoint = "start";
                dx = unit + 5;
                dy = 4;
              }
              if (["SE"].indexOf(dir) > -1) {
                anchorPoint = "start";
                dx = unit + 5;
                dy = unit * 3;
              }
              if (["S"].indexOf(dir) > -1) {
                anchorPoint = "middle";
                dx = 0;
                dy = unit * 3 + 3;
              }
              if (["SW"].indexOf(dir) > -1) {
                anchorPoint = "end";
                dx = -unit - 5;
                dy = unit * 3;
              }
              if (["W"].indexOf(dir) > -1) {
                anchorPoint = "end";
                dx = -unit - 5;
                dy = 4;
              }
              if (["NW"].indexOf(dir) > -1) {
                anchorPoint = "end";
                dx = -unit - 5;
                dy = -unit;
              }

              let groupText = gannotation.select("#type-" + uid + "-" + type);

              if (symbol == "") {
                if (shape == "circle") {
                  groupText
                    .append("g")
                    .append("circle")
                    .attr("r", data[z].size ? data[z].size : 5)
                    .attr("fill", data[z].color ? data[z].color : "#412c26")
                    .attr("stroke", data[z].stroke ? data[z].stroke : "none")
                    .attr(
                      "stroke-width",
                      data[z]["stroke-width"] ? data[z]["stroke-width"] : 0
                    )
                    .attr("opacity", data[z].opacity ? data[z].opacity : 1)
                    .attr(
                      "cx",
                      (function () {
                        return projection([data[z].lat, data[z].lng])[0];
                      })()
                    )
                    .attr(
                      "cy",
                      (function () {
                        return projection([data[z].lat, data[z].lng])[1];
                      })()
                    );
                }
                if (shape == "square") {
                  let customIcon = d3
                    .symbol()
                    .type(d3.symbolSquare)
                    .size(data[z].size ? data[z].size : 5)();
                  groupText
                    .append("path")
                    .attr("d", customIcon)
                    .attr("fill", data[z].color ? data[z].color : "#412c26")
                    .attr("stroke", data[z].stroke ? data[z].stroke : "none")
                    .attr(
                      "stroke-width",
                      data[z]["stroke-width"] ? data[z]["stroke-width"] : 0
                    )
                    .attr("opacity", data[z].opacity ? data[z].opacity : 1)
                    .attr(
                      "transform",
                      `translate(${projection([data[z].lat, data[z].lng])[0]},${
                        projection([data[z].lat, data[z].lng])[1]
                      })`
                    );
                }
                if (shape == "triangle") {
                  let customIcon = d3
                    .symbol()
                    .type(d3.symbolTriangle)
                    .size(data[z].size ? data[z].size : 5)();
                  groupText
                    .append("path")
                    .attr("d", customIcon)
                    .attr("fill", data[z].color ? data[z].color : "#412c26")
                    .attr("stroke", data[z].stroke ? data[z].stroke : "none")
                    .attr(
                      "stroke-width",
                      data[z]["stroke-width"] ? data[z]["stroke-width"] : 0
                    )
                    .attr("opacity", data[z].opacity ? data[z].opacity : 1)
                    .attr(
                      "transform",
                      `translate(${projection([data[z].lat, data[z].lng])[0]},${
                        projection([data[z].lat, data[z].lng])[1]
                      })`
                    )
                    .attr("dx", data[z].dx ? data[z].dx : 0)
                    .attr("dy", data[z].dy ? data[z].dy : 0);
                }
                if (shape == "cross") {
                  let customIcon = d3
                    .symbol()
                    .type(d3.symbolCross)
                    .size(data[z].size ? data[z].size : 5)();
                  groupText
                    .append("path")
                    .attr("d", customIcon)
                    .attr("fill", data[z].color ? data[z].color : "#412c26")
                    .attr("stroke", data[z].stroke ? data[z].stroke : "none")
                    .attr(
                      "stroke-width",
                      data[z]["stroke-width"] ? data[z]["stroke-width"] : 0
                    )
                    .attr("opacity", data[z].opacity ? data[z].opacity : 1)
                    .attr(
                      "transform",
                      `translate(${projection([data[z].lat, data[z].lng])[0]},${
                        projection([data[z].lat, data[z].lng])[1]
                      })`
                    )
                    .attr("dx", data[z].dx ? data[z].dx : 0)
                    .attr("dy", data[z].dy ? data[z].dy : 0);
                }
                if (shape == "diamond") {
                  let customIcon = d3
                    .symbol()
                    .type(d3.symbolDiamond)
                    .size(data[z].size ? data[z].size : 5)();
                  groupText
                    .append("path")
                    .attr("d", customIcon)
                    .attr("fill", data[z].color ? data[z].color : "#412c26")
                    .attr("stroke", data[z].stroke ? data[z].stroke : "none")
                    .attr(
                      "stroke-width",
                      data[z]["stroke-width"] ? data[z]["stroke-width"] : 0
                    )
                    .attr("opacity", data[z].opacity ? data[z].opacity : 1)
                    .attr(
                      "transform",
                      `translate(${projection([data[z].lat, data[z].lng])[0]},${
                        projection([data[z].lat, data[z].lng])[1]
                      })`
                    )
                    .attr("dx", data[z].dx ? data[z].dx : 0)
                    .attr("dy", data[z].dy ? data[z].dy : 0);
                }
                if (shape == "star") {
                  let customIcon = d3
                    .symbol()
                    .type(d3.symbolStar)
                    .size(data[z].size ? data[z].size : 5)();
                  groupText
                    .append("path")
                    .attr("d", customIcon)
                    .attr("fill", data[z].color ? data[z].color : "#412c26")
                    .attr("stroke", data[z].stroke ? data[z].stroke : "none")
                    .attr(
                      "stroke-width",
                      data[z]["stroke-width"] ? data[z]["stroke-width"] : 0
                    )
                    .attr("opacity", data[z].opacity ? data[z].opacity : 1)
                    .attr(
                      "transform",
                      `translate(${projection([data[z].lat, data[z].lng])[0]},${
                        projection([data[z].lat, data[z].lng])[1]
                      })`
                    )
                    .attr("dx", data[z].dx ? data[z].dx : 0)
                    .attr("dy", data[z].dy ? data[z].dy : 0);
                }
                if (shape == "wye") {
                  let customIcon = d3
                    .symbol()
                    .type(d3.symbolWye)
                    .size(data[z].size ? data[z].size : 5)();
                  groupText
                    .append("path")
                    .attr("d", customIcon)
                    .attr("fill", data[z].color ? data[z].color : "#412c26")
                    .attr("stroke", data[z].stroke ? data[z].stroke : "none")
                    .attr(
                      "stroke-width",
                      data[z]["stroke-width"] ? data[z]["stroke-width"] : 0
                    )
                    .attr("opacity", data[z].opacity ? data[z].opacity : 1)
                    .attr(
                      "transform",
                      `translate(${projection([data[z].lat, data[z].lng])[0]},${
                        projection([data[z].lat, data[z].lng])[1]
                      })`
                    )
                    .attr("dx", data[z].dx ? data[z].dx : 0)
                    .attr("dy", data[z].dy ? data[z].dy : 0);
                }
              } else {
                groupText
                  .append("use")
                  .attr("href", symbol)
                  .attr(
                    "transform",
                    `translate(${projection([data[z].lat, data[z].lng])[0]},${
                      projection([data[z].lat, data[z].lng])[1]
                    })`
                  )
                  .attr("dx", data[z].dx ? data[z].dx : 0)
                  .attr("dy", data[z].dy ? data[z].dy : 0);
              }

              if (["C"].indexOf(dir) > -1) {
                groupText
                  .append("text")
                  .attr("id", `${data[z].name}`.replace(" ", "_")) //should be replace all
                  .attr("class", labelClass)
                  .attr("text-anchor", anchorPoint)
                  .attr("alignment-baseline", "middle")
                  .text(data[z].name)
                  .attr("transform", `translate(${dx}, ${dy})`)
                  .attr(
                    "x",
                    (function () {
                      return projection([data[z].lat, data[z].lng])[0];
                    })()
                  )
                  .attr(
                    "y",
                    (function () {
                      return projection([data[z].lat, data[z].lng])[1];
                    })()
                  );
              } else {
                groupText
                  .append("text")
                  .attr("id", `${data[z].name}`.replace(" ", "_")) //should be replace all
                  .attr("class", labelClass)
                  .attr("text-anchor", anchorPoint)
                  .text(data[z].name)
                  .attr("transform", `translate(${dx}, ${dy})`)
                  .attr(
                    "x",
                    (function () {
                      return projection([data[z].lat, data[z].lng])[0];
                    })()
                  )
                  .attr(
                    "y",
                    (function () {
                      return projection([data[z].lat, data[z].lng])[1];
                    })()
                  );
              }
            }
          }
        } else {
        }
      }
    }

    return graphic.node();
  }
}


function createLookupTable(colors, hexCodes) {
    const lookupTable = new Map();
  
    if (colors.length !== hexCodes.length) {
      throw new Error("Arrays must have the same length");
    }
  
    for (let i = 0; i < colors.length; i++) {
      lookupTable.set(colors[i], hexCodes[i]);
    }
  
    return lookupTable;
  }

  const colors = [
    "primary",
    "secondary",
    "land",
    "secondary-border",
    "water",
    "graticule",
    "primary-border",
    "delete"
  ]

  const hex = [
    "#ccf5d4",
    "#fffa70",
    "#d1d1d1",
    "#a6a6a6",
    "#558b6d",
    "#bbf2d3",
    "#2b2e3b",
    "none"
  ]

const mycolors = createLookupTable(colors, hex)

const moriarty_innerlines_detail = topojson.feature(
  ls_admin0_innerlines,
  ls_admin0_innerlines.objects.Admin_0_Lines
).features

const moriarty_polys0_detail = topojson.feature(
  ls_admin0_polys,
  ls_admin0_polys.objects.Admin_0_Polygons
).features

const moriarty_polys1_detail = topojson.feature(
  ls_admin1_polys,
  ls_admin1_polys.objects.Admin_1_Polygons
).features

const moriarty_land_detail = topojson.feature(ls_land, ls_land.objects.Land).features

const moriarty_rivers_detail = topojson.feature(ls_rivers, ls_rivers.objects.Rivers)
  .features

const moriarty_water_detail = topojson.feature(
  ls_waterbodies,
  ls_waterbodies.objects.Waterbodies
).features

const moriarty_innerlines_simple = topojson.feature(
  ss_admin0_innerlines,
  ss_admin0_innerlines.objects.Admin_0_lines
).features



const moriarty_polys0_simple = topojson.feature(
  ss_admin0_polys,
  ss_admin0_polys.objects.Admin_0_polygons
).features



const moriarty_land_simple = topojson.feature(ss_land, ss_land.objects.Land).features

const moriarty_rivers_simple = topojson.feature(ss_rivers, ss_rivers.objects.Rivers)
  .features

const moriarty_water_simple = topojson.feature(
  ss_waterbodies,
  ss_waterbodies.objects.Waterbodies
).features




const moriarty = ({
    innerlines: {
      detail: moriarty_innerlines_detail,
      simple: moriarty_innerlines_simple
    },
    admin0: { detail: moriarty_polys0_detail, simple: moriarty_polys0_simple },
    admin1: { detail: moriarty_polys1_detail, simple: null },
    land: { detail: moriarty_land_detail, simple: moriarty_land_simple },
    river: { detail: moriarty_rivers_detail, simple: moriarty_rivers_simple },
    water: { detail: moriarty_water_detail, simple: moriarty_water_simple }
  })


  const highlightPrimary = [
    "Belgium",
    "Canada",
    "Denmark",
    "Greenland",
    "France",
    "Iceland",
    "Italy",
    "Luxembourg",
    "Netherlands",
    "Norway",
    "Portugal",
    "United Kingdom",
    "United States of America",
    "Greece",
    "Turkey",
    "Spain",
    "Germany",
    "Czech Republic",
    "Hungary",
    "Poland",
    "Bulgaria",
    "Estonia",
    "Latvia",
    "Lithuania",
    "Romania",
    "Slovakia",
    "Slovenia",
    "Albania",
    "Croatia",
    "Montenegro",
    "North Macedonia",
    "Macedonia",
    "Finland",
    "Sweden"
  ]

  const highlightSecondary = ["Russia", "Belarus"]

const defaultSettings = ({
    width: 1152,
    height: null,
    bounds: {
      bounder: false,
      countries: null,
      feature: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, -90],
              [0, 90],
              [180, 90],
              [180, -90],
              [0, -90]
            ]
          ]
        }
      }
    },
    clipping: {
      clip: false,
      margin: 0
    },
    projection: {
      type: "default",
      proj: d3.geoMiller(),
      fit: "size",
      translate: false, // [this.width / 2, this.height / 2]
      scale: false, // 5000
      center: false, // []
      rotate: false, // [0,0,0]
      tilt: false, //
      distance: false,
      clipExtent: false,
      clipAngle: false,
      precision: false
    },
    rotation: {
      value: [0, 0, 0],
      rotate: false
    },
    basemap: {
      coastline: {
        show: true,
        style: { fill: "none", stroke: "#dddddd", opacity: 1 }
      },
      background: {
        show: false,
        style: { fill: "#ffffff", stroke: "none", opacity: 1 }
      },
      land: {
        show: true,
        geometry: countries,
        key: "GID_0",
        label: "NAME_0",
        style: { fill: "#fffff9", stroke: "none", opacity: 1 }
      },
      border: {
        show: true,
        geometry: countries,
        style: { fill: "none", stroke: "#dedede ", opacity: 1 }
      },
      ocean: {
        show: true,
        geometry: null,
        style: { fill: "#f2f2f2", stroke: "none", opacity: 1 }
      },
      lake: {
        show: true,
        geometry: lakes,
        style: { fill: "#f2f2f2", stroke: "none", opacity: 1, "stroke-width": 1 }
      },
      river: {
        show: false,
        geometry: null,
        style: { fill: "none", stroke: "blue", opacity: 1 }
      },
      graticule: {
        show: false,
        style: { fill: "none", stroke: "gray", opacity: 1 }
      }
    },
    graticule: {
      step: null, //10
      show: false,
      custom: {
        gc: true,
        show: true,
        latitude: [66.5], // Tropic of Cancer, Equator, Arctic Circle
        longitude: [],
        latBounds: [-93.5, 14],
        lonBounds: [50, 83],
        style: {
          stroke: "#0a1f35",
          "stroke-width": 1,
          opacity: 1,
          "stroke-dasharray": "none"
        }
      }
    },
    layer: {
      points: { show: false, data: null }, //[{}]}, points
      polys: { show: false, data: null }, //polygons polylines
      tiles: { show: false, data: null }, //[{id: type: delta:}] },
      grids: { show: false, data: null }
    },
    scalebar: {
      show: false,
      topValue: 200,
      topUnit: "km",
      bottomValue: 200,
      bottomUnit: "mi",
      position: [120, 50]
    },
    label: {
      show: false,
      country: null, //[] list of names
      style: null // {}
    },
    graphic: {
      width: null,
      height: null,
      title: {
        show: false,
        text: null
      },
      subtitle: {
        show: false,
        text: null
      },
      note: {
        show: false,
        text: null
      },
      logo: {
        show: false,
        text: null
      },
      template: null //{}
    }
  })

  const terrainSettings = ({
    width: 1152,
    height: null,
    bounds: {
      bounder: false,
      countries: null,
      feature: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, -90],
              [0, 90],
              [180, 90],
              [180, -90],
              [0, -90]
            ]
          ]
        }
      }
    },
    clipping: {
      clip: false,
      margin: 0
    },
    projection: {
      type: "default",
      proj: d3.geoMiller(),
      fit: "size",
      translate: false, // [this.width / 2, this.height / 2]
      scale: false, // 5000
      center: false, // []
      rotate: false, // [0,0,0]
      tilt: false, //
      distance: false,
      clipExtent: false,
      clipAngle: false,
      precision: false
    },
    rotation: {
      value: [0, 0, 0],
      rotate: false
    },
    basemap: {
      coastline: {
        show: false,
        style: { fill: "none", stroke: "#dddddd", opacity: 1 }
      },
      background: {
        show: false,
        style: { fill: "f2f2f2", stroke: "none", opacity: 1 }
      },
      land: {
        show: true,
        geometry: null,
        key: "GID_0",
        label: "NAME_0",
        style: { fill: "#fffff9", stroke: "none", opacity: 0.7 }
      },
      border: {
        show: true,
        geometry: null,
        style: { fill: "none", stroke: "red ", opacity: 1 }
      },
      ocean: {
        show: false,
        geometry: null,
        style: { fill: "#f2f2f2", stroke: "none", opacity: 1 }
      },
      lake: {
        show: false,
        geometry: null,
        style: { fill: "#f2f2f2", stroke: "none", opacity: 1, "stroke-width": 1 }
      },
      river: {
        show: false,
        geometry: null,
        style: { fill: "none", stroke: "blue", opacity: 1 }
      },
      graticule: {
        show: false
      }
    },
    graticule: {
      step: null, //10
      show: false,
      custom: {
        show: false,
        latitude: {
          min: null,
          max: null
        },
        longitude: {
          min: null,
          max: null
        },
        style: {
          stroke: "red",
          "stroke-width": 1,
          opacity: 1,
          "stroke-dasharray": "none"
        }
      }
    },
    layer: {
      points: { show: false, data: null }, //[{}]}, points
      polys: { show: false, data: null }, //polygons polylines
      tiles: { show: false, data: null }, //[{id: type: delta:}] },
      grids: { show: false, data: null }
    },
    scalebar: {
      show: false,
      topValue: 200,
      topUnit: "km",
      bottomValue: 200,
      bottomUnit: "mi",
      position: [120, 50]
    },
    label: {
      show: false,
      country: null, //[] list of names
      style: null // {}
    }
  })

  const newsletterSettingsSimple = ({
    width: 1152,
    height: null,
    bounds: {
      bounder: false,
      countries: null,
      feature: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, -90],
              [0, 90],
              [180, 90],
              [180, -90],
              [0, -90]
            ]
          ]
        }
      }
    },
    clipping: {
      clipAntimeridian: false, //true, 90, 180, ##
      clip: false,
      margin: 0
    },
    projection: {
      type: "default",
      proj: d3.geoMiller(),
      fit: "size",
      translate: false, // [this.width / 2, this.height / 2]
      scale: false, // 5000
      center: false, // []
      rotate: false, // [0,0,0]
      tilt: false, //
      distance: false,
      clipExtent: false,
      clipAngle: false,
      precision: false
    },
    rotation: {
      value: [0, 0, 0],
      rotate: false
    },
    basemap: {
      coastline: {
        show: false,
        style: { fill: "none", stroke: "#dddddd", opacity: 1 }
      },
      background: {
        show: false,
        style: { fill: mycolors.get("water"), stroke: "none", opacity: 1 }
      },
      land: {
        show: false,
        geometry: null,
        key: "GID_0",
        label: "NAME_0",
        style: { fill: "#fffff9", stroke: "none", opacity: 1 }
      },
      border: {
        show: false,
        geometry: null,
        style: { fill: "none", stroke: "#dedede ", opacity: 1 }
      },
      ocean: {
        show: false,
        geometry: null,
        style: { fill: "blue", stroke: "none", opacity: 1 }
      },
      lake: {
        show: false,
        geometry: null,
        style: { fill: "#f2f2f2", stroke: "none", opacity: 1, "stroke-width": 1 }
      },
      river: {
        show: false,
        geometry: null,
        style: { fill: "none", stroke: "blue", opacity: 1 }
      },
      graticule: {
        show: false,
        geometry: null,
        style: { fill: "none", stroke: "blue", opacity: 1 }
      }
    },
    graticule: {
      step: null, //10
      show: false,
      custom: {
        show: false,
        latitude: {
          min: null,
          max: null
        },
        longitude: {
          min: null,
          max: null
        },
        style: {
          stroke: "red",
          "stroke-width": 1,
          opacity: 1,
          "stroke-dasharray": "none"
        }
      }
    },
    layer: {
      points: { show: false, data: null }, //[{}]}, points
      polys: {
        show: true,
        data: [
          {
            geometry: e.features,
            style: { fill: mycolors.get("water"), stroke: "none" }
          },
          {
            geometry: w.features,
            style: { fill: mycolors.get("water"), stroke: "none" }
          },
  
          {
            geometry: d3
              .geoGraticule()
              .step([30, 30])
              .extent([
                [-185, -85],
                [185, 85]
              ])
              .lines()
              .concat(
                d3
                  .geoGraticule()
                  .step([0, 12])
                  .extent([
                    [-180, 45],
                    [180, 90]
                  ])
                  .lines()
              ),
            style: { fill: "none", stroke: mycolors.get("graticule") }
          },
          {
            geometry: moriarty.land.simple,
            style: { fill: mycolors.get("land"), stroke: "none" }
          },
          {
            geometry: moriarty.water.simple,
            style: { fill: mycolors.get("water"), stroke: "none" }
          },
          {
            geometry: moriarty.admin0.simple,
            style: {
              fill: function (d) {
                if (highlightPrimary.indexOf(d.properties.Name) > -1) {
                  return mycolors.get("primary");
                } else if (highlightSecondary.indexOf(d.properties.Name) > -1) {
                  return mycolors.get("secondary");
                } else {
                  return mycolors.get("delete");
                }
              }
            }
          },
          {
            geometry: moriarty.admin0.simple,
            style: {
              stroke: function (d) {
                if (
                  highlightPrimary
                    .concat(highlightSecondary)
                    .indexOf(d.properties.Name) > -1
                ) {
                  return mycolors.get("delete");
                } else {
                  return mycolors.get("secondary-border");
                }
              },
              fill: "none"
            }
          },
          {
            geometry: moriarty.admin0.simple,
            style: {
              stroke: function (d) {
                if (
                  highlightPrimary
                    .concat(highlightSecondary)
                    .indexOf(d.properties.Name) > -1
                ) {
                  return mycolors.get("primary-border");
                } else {
                  return mycolors.get("delete");
                }
              },
              fill: "none"
            }
          },
  
          {
            geometry: disputed,
            style: { fill: "none", stroke: "magenta" }
          },
          {
            geometry: moriarty.land.simple,
            style: { fill: "none", stroke: mycolors.get("primary-border") }
          },
          {
            geometry: moriarty.innerlines.simple,
            style: { fill: "none", stroke: mycolors.get("primary-border") }
          }
        ]
      }, //polygons polylines
      tiles: { show: false, data: null }, //[{id: type: delta:}] },
      grids: { show: false, data: null }
    },
    scalebar: {
      show: false,
      topValue: 200,
      topUnit: "km",
      bottomValue: 200,
      bottomUnit: "mi",
      position: [120, 50]
    },
    label: {
      show: false,
      country: null, //[] list of names
      style: null // {}
    }
  })

  const newsletterSettingsDetail = ({
    width: 1152,
    height: null,
    bounds: {
      bounder: false,
      countries: null,
      feature: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, -90],
              [0, 90],
              [180, 90],
              [180, -90],
              [0, -90]
            ]
          ]
        }
      }
    },
    clipping: {
      clipAntimeridian: false, //true, 90, 180, ##
      clip: false,
      margin: 0
    },
    projection: {
      type: "default",
      proj: d3.geoMiller(),
      fit: "size",
      translate: false, // [this.width / 2, this.height / 2]
      scale: false, // 5000
      center: false, // []
      rotate: false, // [0,0,0]
      tilt: false, //
      distance: false,
      clipExtent: false,
      clipAngle: false,
      precision: false
    },
    rotation: {
      value: [0, 0, 0],
      rotate: false
    },
    basemap: {
      coastline: {
        show: false,
        style: { fill: "none", stroke: "#dddddd", opacity: 1 }
      },
      background: {
        show: false,
        style: { fill: mycolors.get("water"), stroke: "none", opacity: 1 }
      },
      land: {
        show: false,
        geometry: null,
        key: "GID_0",
        label: "NAME_0",
        style: { fill: "#fffff9", stroke: "none", opacity: 1 }
      },
      border: {
        show: false,
        geometry: null,
        style: { fill: "none", stroke: "#dedede ", opacity: 1 }
      },
      ocean: {
        show: false,
        geometry: null,
        style: { fill: "blue", stroke: "none", opacity: 1 }
      },
      lake: {
        show: false,
        geometry: null,
        style: { fill: "#f2f2f2", stroke: "none", opacity: 1, "stroke-width": 1 }
      },
      river: {
        show: false,
        geometry: null,
        style: { fill: "none", stroke: "blue", opacity: 1 }
      },
      graticule: {
        show: false,
        geometry: null,
        style: { fill: "none", stroke: "blue", opacity: 1 }
      }
    },
    graticule: {
      step: null, //10
      show: false,
      custom: {
        show: false,
        latitude: {
          min: null,
          max: null
        },
        longitude: {
          min: null,
          max: null
        },
        style: {
          stroke: "red",
          "stroke-width": 1,
          opacity: 1,
          "stroke-dasharray": "none"
        }
      }
    },
    layer: {
      points: { show: false, data: null }, //[{}]}, points
      polys: {
        show: true,
        data: [
          {
            geometry: e.features,
            style: { fill: mycolors.get("water"), stroke: "none" }
          },
          {
            geometry: w.features,
            style: { fill: mycolors.get("water"), stroke: "none" }
          },
  
          {
            geometry: d3
              .geoGraticule()
              .step([30, 30])
              .extent([
                [-185, -85],
                [185, 85]
              ])
              .lines()
              .concat(
                d3
                  .geoGraticule()
                  .step([0, 12])
                  .extent([
                    [-180, 45],
                    [180, 90]
                  ])
                  .lines()
              ),
            style: { fill: "none", stroke: mycolors.get("graticule") }
          },
          {
            geometry: moriarty.land.detail,
            style: { fill: mycolors.get("land"), stroke: "none" }
          },
          {
            geometry: moriarty.water.detail,
            style: { fill: mycolors.get("water"), stroke: "none" }
          },
          {
            geometry: moriarty.admin0.detail,
            style: {
              fill: function (d) {
                if (highlightPrimary.indexOf(d.properties.Name) > -1) {
                  return mycolors.get("primary");
                } else if (highlightSecondary.indexOf(d.properties.Name) > -1) {
                  return mycolors.get("secondary");
                } else {
                  return mycolors.get("delete");
                }
              }
            }
          },
          {
            geometry: moriarty.admin0.detail,
            style: {
              stroke: function (d) {
                if (
                  highlightPrimary
                    .concat(highlightSecondary)
                    .indexOf(d.properties.Name) > -1
                ) {
                  return mycolors.get("delete");
                } else {
                  return mycolors.get("secondary-border");
                }
              },
              fill: "none"
            }
          },
          {
            geometry: moriarty.admin0.detail,
            style: {
              stroke: function (d) {
                if (
                  highlightPrimary
                    .concat(highlightSecondary)
                    .indexOf(d.properties.Name) > -1
                ) {
                  return mycolors.get("primary-border");
                } else {
                  return mycolors.get("delete");
                }
              },
              fill: "none"
            }
          },
  
          {
            geometry: disputed,
            style: { fill: "none", stroke: "magenta" }
          },
          {
            geometry: moriarty.land.detail,
            style: { fill: "none", stroke: mycolors.get("primary-border") }
          },
          {
            geometry: moriarty.innerlines.detail,
            style: { fill: "none", stroke: mycolors.get("primary-border") }
          }
        ]
      }, //polygons polylines
      tiles: { show: false, data: null }, //[{id: type: delta:}] },
      grids: { show: false, data: null }
    },
    scalebar: {
      show: false,
      topValue: 200,
      topUnit: "km",
      bottomValue: 200,
      bottomUnit: "mi",
      position: [120, 50]
    },
    label: {
      show: false,
      country: null, //[] list of names
      style: null // {}
    }
  })

export { 
    d3,
    topojson,
    FileAttachment,
    defaultSettings,
    terrainSettings,
    newsletterSettingsDetail,
    newsletterSettingsSimple,
    queryOverpass,
    proj4,
    turf,
    geojsonrewind,
}