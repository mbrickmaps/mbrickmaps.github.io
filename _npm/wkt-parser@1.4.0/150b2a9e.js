/**
 * Bundled by jsDelivr using Rollup v2.79.1 and Terser v5.19.2.
 * Original file: /npm/wkt-parser@1.4.0/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
var t=1,e=/\s/,a=/[A-Za-z]/,r=/[A-Za-z84_]/,i=/[,\]]/,n=/[\d\.E\-\+]/;function o(e){if("string"!=typeof e)throw new Error("not a string");this.text=e.trim(),this.level=0,this.place=0,this.root=null,this.stack=[],this.currentObject=null,this.state=t}function s(t,e,a){Array.isArray(e)&&(a.unshift(e),e=null);var r=e?{}:t,i=a.reduce((function(t,e){return l(e,t),t}),r);e&&(t[e]=i)}function l(t,e){if(Array.isArray(t)){var a=t.shift();if("PARAMETER"===a&&(a=t.shift()),1===t.length)return Array.isArray(t[0])?(e[a]={},void l(t[0],e[a])):void(e[a]=t[0]);if(t.length)if("TOWGS84"!==a){if("AXIS"===a)return a in e||(e[a]=[]),void e[a].push(t);var r;switch(Array.isArray(a)||(e[a]={}),a){case"UNIT":case"PRIMEM":case"VERT_DATUM":return e[a]={name:t[0].toLowerCase(),convert:t[1]},void(3===t.length&&l(t[2],e[a]));case"SPHEROID":case"ELLIPSOID":return e[a]={name:t[0],a:t[1],rf:t[2]},void(4===t.length&&l(t[3],e[a]));case"EDATUM":case"ENGINEERINGDATUM":case"LOCAL_DATUM":case"DATUM":case"VERT_CS":case"VERTCRS":case"VERTICALCRS":return t[0]=["name",t[0]],void s(e,a,t);case"COMPD_CS":case"COMPOUNDCRS":case"FITTED_CS":case"PROJECTEDCRS":case"PROJCRS":case"GEOGCS":case"GEOCCS":case"PROJCS":case"LOCAL_CS":case"GEODCRS":case"GEODETICCRS":case"GEODETICDATUM":case"ENGCRS":case"ENGINEERINGCRS":return t[0]=["name",t[0]],s(e,a,t),void(e[a].type=a);default:for(r=-1;++r<t.length;)if(!Array.isArray(t[r]))return l(t,e[a]);return s(e,a,t)}}else e[a]=t;else e[a]=!0}else e[t]=!0}o.prototype.readCharicter=function(){var a=this.text[this.place++];if(4!==this.state)for(;e.test(a);){if(this.place>=this.text.length)return;a=this.text[this.place++]}switch(this.state){case t:return this.neutral(a);case 2:return this.keyword(a);case 4:return this.quoted(a);case 5:return this.afterquote(a);case 3:return this.number(a);case-1:return}},o.prototype.afterquote=function(t){if('"'===t)return this.word+='"',void(this.state=4);if(i.test(t))return this.word=this.word.trim(),void this.afterItem(t);throw new Error("havn't handled \""+t+'" in afterquote yet, index '+this.place)},o.prototype.afterItem=function(e){return","===e?(null!==this.word&&this.currentObject.push(this.word),this.word=null,void(this.state=t)):"]"===e?(this.level--,null!==this.word&&(this.currentObject.push(this.word),this.word=null),this.state=t,this.currentObject=this.stack.pop(),void(this.currentObject||(this.state=-1))):void 0},o.prototype.number=function(t){if(!n.test(t)){if(i.test(t))return this.word=parseFloat(this.word),void this.afterItem(t);throw new Error("havn't handled \""+t+'" in number yet, index '+this.place)}this.word+=t},o.prototype.quoted=function(t){'"'!==t?this.word+=t:this.state=5},o.prototype.keyword=function(e){if(r.test(e))this.word+=e;else{if("["===e){var a=[];return a.push(this.word),this.level++,null===this.root?this.root=a:this.currentObject.push(a),this.stack.push(this.currentObject),this.currentObject=a,void(this.state=t)}if(!i.test(e))throw new Error("havn't handled \""+e+'" in keyword yet, index '+this.place);this.afterItem(e)}},o.prototype.neutral=function(t){if(a.test(t))return this.word=t,void(this.state=2);if('"'===t)return this.word="",void(this.state=4);if(n.test(t))return this.word=t,void(this.state=3);if(!i.test(t))throw new Error("havn't handled \""+t+'" in neutral yet, index '+this.place);this.afterItem(t)},o.prototype.output=function(){for(;this.place<this.text.length;)this.readCharicter();if(-1===this.state)return this.root;throw new Error('unable to parse string "'+this.text+'". State is '+this.state)};var d=.017453292519943295,u=["PROJECTEDCRS","PROJCRS","GEOGCS","GEOCCS","PROJCS","LOCAL_CS","GEODCRS","GEODETICCRS","GEODETICDATUM","ENGCRS","ENGINEERINGCRS"];function h(t){return t*d}function c(t){for(var e=Object.keys(t),a=0,r=e.length;a<r;++a){var i=e[a];-1!==u.indexOf(i)&&f(t[i]),"object"==typeof t[i]&&c(t[i])}}function f(t){if(t.AUTHORITY){var e=Object.keys(t.AUTHORITY)[0];e&&e in t.AUTHORITY&&(t.title=e+":"+t.AUTHORITY[e])}if("GEOGCS"===t.type?t.projName="longlat":"LOCAL_CS"===t.type?(t.projName="identity",t.local=!0):"object"==typeof t.PROJECTION?t.projName=Object.keys(t.PROJECTION)[0]:t.projName=t.PROJECTION,t.AXIS){for(var a="",r=0,i=t.AXIS.length;r<i;++r){var n=[t.AXIS[r][0].toLowerCase(),t.AXIS[r][1].toLowerCase()];-1!==n[0].indexOf("north")||("y"===n[0]||"lat"===n[0])&&"north"===n[1]?a+="n":-1!==n[0].indexOf("south")||("y"===n[0]||"lat"===n[0])&&"south"===n[1]?a+="s":-1!==n[0].indexOf("east")||("x"===n[0]||"lon"===n[0])&&"east"===n[1]?a+="e":-1===n[0].indexOf("west")&&("x"!==n[0]&&"lon"!==n[0]||"west"!==n[1])||(a+="w")}2===a.length&&(a+="u"),3===a.length&&(t.axis=a)}t.UNIT&&(t.units=t.UNIT.name.toLowerCase(),"metre"===t.units&&(t.units="meter"),t.UNIT.convert&&("GEOGCS"===t.type?t.DATUM&&t.DATUM.SPHEROID&&(t.to_meter=t.UNIT.convert*t.DATUM.SPHEROID.a):t.to_meter=t.UNIT.convert));var o=t.GEOGCS;function s(e){return e*(t.to_meter||1)}"GEOGCS"===t.type&&(o=t),o&&(o.DATUM?t.datumCode=o.DATUM.name.toLowerCase():t.datumCode=o.name.toLowerCase(),"d_"===t.datumCode.slice(0,2)&&(t.datumCode=t.datumCode.slice(2)),"new_zealand_1949"===t.datumCode&&(t.datumCode="nzgd49"),"wgs_1984"!==t.datumCode&&"world_geodetic_system_1984"!==t.datumCode||("Mercator_Auxiliary_Sphere"===t.PROJECTION&&(t.sphere=!0),t.datumCode="wgs84"),"belge_1972"===t.datumCode&&(t.datumCode="rnb72"),o.DATUM&&o.DATUM.SPHEROID&&(t.ellps=o.DATUM.SPHEROID.name.replace("_19","").replace(/[Cc]larke\_18/,"clrk"),"international"===t.ellps.toLowerCase().slice(0,13)&&(t.ellps="intl"),t.a=o.DATUM.SPHEROID.a,t.rf=parseFloat(o.DATUM.SPHEROID.rf,10)),o.DATUM&&o.DATUM.TOWGS84&&(t.datum_params=o.DATUM.TOWGS84),~t.datumCode.indexOf("osgb_1936")&&(t.datumCode="osgb36"),~t.datumCode.indexOf("osni_1952")&&(t.datumCode="osni52"),(~t.datumCode.indexOf("tm65")||~t.datumCode.indexOf("geodetic_datum_of_1965"))&&(t.datumCode="ire65"),"ch1903+"===t.datumCode&&(t.datumCode="ch1903"),~t.datumCode.indexOf("israel")&&(t.datumCode="isr93")),t.b&&!isFinite(t.b)&&(t.b=t.a);[["standard_parallel_1","Standard_Parallel_1"],["standard_parallel_1","Latitude of 1st standard parallel"],["standard_parallel_2","Standard_Parallel_2"],["standard_parallel_2","Latitude of 2nd standard parallel"],["false_easting","False_Easting"],["false_easting","False easting"],["false-easting","Easting at false origin"],["false_northing","False_Northing"],["false_northing","False northing"],["false_northing","Northing at false origin"],["central_meridian","Central_Meridian"],["central_meridian","Longitude of natural origin"],["central_meridian","Longitude of false origin"],["latitude_of_origin","Latitude_Of_Origin"],["latitude_of_origin","Central_Parallel"],["latitude_of_origin","Latitude of natural origin"],["latitude_of_origin","Latitude of false origin"],["scale_factor","Scale_Factor"],["k0","scale_factor"],["latitude_of_center","Latitude_Of_Center"],["latitude_of_center","Latitude_of_center"],["lat0","latitude_of_center",h],["longitude_of_center","Longitude_Of_Center"],["longitude_of_center","Longitude_of_center"],["longc","longitude_of_center",h],["x0","false_easting",s],["y0","false_northing",s],["long0","central_meridian",h],["lat0","latitude_of_origin",h],["lat0","standard_parallel_1",h],["lat1","standard_parallel_1",h],["lat2","standard_parallel_2",h],["azimuth","Azimuth"],["alpha","azimuth",h],["srsCode","name"]].forEach((function(e){return a=t,i=(r=e)[0],n=r[1],void(!(i in a)&&n in a&&(a[i]=a[n],3===r.length&&(a[i]=r[2](a[i]))));var a,r,i,n})),t.long0||!t.longc||"Albers_Conic_Equal_Area"!==t.projName&&"Lambert_Azimuthal_Equal_Area"!==t.projName||(t.long0=t.longc),t.lat_ts||!t.lat1||"Stereographic_South_Pole"!==t.projName&&"Polar Stereographic (variant B)"!==t.projName?!t.lat_ts&&t.lat0&&"Polar_Stereographic"===t.projName&&(t.lat_ts=t.lat0,t.lat0=h(t.lat0>0?90:-90)):(t.lat0=h(t.lat1>0?90:-90),t.lat_ts=t.lat1)}function _(t){var e=new o(t).output(),a=e[0],r={};return l(e,r),c(r),r[a]}export{_ as default};