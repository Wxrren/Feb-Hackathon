import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { useGeoJson } from '../../hooks/useGeoJson';
import { capitalizeString } from '../../utils/capitalizeString';
import { metricNiceName } from '../../utils/metricHelpers';
import { useContainerWidth } from '../../hooks/useContainerWidth';

const quarterToNumber = (q) => {
	if (typeof q === 'number') return q;
	const m = String(q).match(/Q(\d)/i);
	return m ? Number(m[1]) : q;
};

const normaliseRegionName = (name) => {
	if (!name) return name;
	if (name === 'East of England') return 'Eastern';
	return name;
};

export default function ChoroplethMap({ rows = [], level, quarter, metric }) {
	const { geojson, error, loading } = useGeoJson(level);
	const { ref: plotWrapRef, width: plotWrapWidth } = useContainerWidth();

	// ✅ Use a realistic breakpoint
	const isMobile = plotWrapWidth > 0 && plotWrapWidth < 640;

	// Mobile-first spacing
	const bottomMargin = isMobile ? 52 : 85;
	const colorbarY = isMobile ? -0.12 : -0.14;
	const colorbarLen = isMobile ? 0.98 : 0.95;
	const colorbarThickness = isMobile ? 10 : 15;

	// Plot margins: truly edge-to-edge on mobile
	const margin = isMobile
		? { l: 0, r: 0, t: 0, b: bottomMargin }
		: { l: 10, r: 10, t: 10, b: bottomMargin };

	// Slight zoom-in on mobile to reduce “dead space”
	const projectionScale = isMobile ? 1.12 : 1;

	const qNum = useMemo(() => quarterToNumber(quarter), [quarter]);

	const isMappableLevel = useMemo(
		() => level === 'country' || level === 'region',
		[level],
	);

	const metricRange = useMemo(() => {
		if (!rows || rows.length === 0) return { min: 0, max: 1 };

		const values = rows
			.map((r) => {
				if ('metric' in r && 'value' in r) {
					return r.metric === metric ? Number(r.value) : null;
				}
				return Number(r[metric]);
			})
			.filter((v) => Number.isFinite(v));

		if (values.length === 0) return { min: 0, max: 1 };

		return { min: Math.min(...values), max: Math.max(...values) };
	}, [rows, metric]);

	const feature = useMemo(() => {
		if (level === 'country')
			return { idKey: 'properties.CTRY24NM', nameProp: 'CTRY24NM' };
		if (level === 'region')
			return { idKey: 'properties.EER13NM', nameProp: 'EER13NM' };
		return { idKey: 'id', nameProp: null };
	}, [level]);

	const slicedRows = useMemo(() => {
		if (!isMappableLevel) return [];
		return rows.filter((r) => {
			const rowLevel = r.geography_level ?? r.level;
			if (rowLevel !== level) return false;
			if (quarterToNumber(r.quarter) !== qNum) return false;
			return true;
		});
	}, [rows, level, qNum, isMappableLevel]);

	const valueByName = useMemo(() => {
		const map = new Map();
		for (const r of slicedRows) {
			let name = r.geography ?? r.name ?? r.code;
			if (!name) continue;
			if (level === 'region') name = normaliseRegionName(name);

			let v;
			if ('metric' in r && 'value' in r) {
				if (r.metric !== metric) continue;
				v = Number(r.value);
			} else {
				v = Number(r[metric]);
			}

			if (!Number.isFinite(v)) continue;
			map.set(name, v);
		}
		return map;
	}, [slicedRows, metric, level]);

	const geoLocations = useMemo(() => {
		if (!geojson?.features || !feature.nameProp) return [];
		return geojson.features
			.map((f) => f?.properties?.[feature.nameProp])
			.filter((name) => name && valueByName.has(name));
	}, [geojson, feature.nameProp, valueByName]);

	const zValues = useMemo(() => {
		return geoLocations.map((name) => valueByName.get(name));
	}, [geoLocations, valueByName]);

	const hasAnyValue = zValues.some((v) => v != null && Number.isFinite(v));

	// --- UI guards ---
	if (!isMappableLevel) {
		return (
			<div className='rounded-xl bg-white/70 p-4 text-sm text-gray-700'>
				Map is available for <b>Country</b> and <b>Region</b> levels only.
			</div>
		);
	}

	if (error)
		return <div className='p-4 text-red-600'>GeoJSON error: {error}</div>;
	if (loading || !geojson?.features?.length)
		return <div className='p-4 text-gray-600'>Loading map…</div>;

	if (plotWrapWidth <= 0) {
		return <div className='p-4 text-gray-600'>Preparing map…</div>;
	}

	if (!geoLocations.length || !hasAnyValue) {
		return (
			<div className='rounded-xl bg-white/70 p-4 text-sm text-gray-700'>
				No mappable data for <b>{capitalizeString(level)}</b> • Q
				<b>{quarter}</b> • <b>{metricNiceName(metric)}</b>.
			</div>
		);
	}
	const plotKey = `choropleth-${level}-${plotWrapWidth}`;

	return (
		<div
			className={`
				bg-white/70 shadow flex flex-col
				${isMobile ? '-mx-4 rounded-none p-2' : 'rounded-2xl p-4'}
				h-130 sm:h-150 md:h-180
			`}
		>
			<h2 className='font-semibold mb-2'>Map: {metricNiceName(metric)}</h2>
			<h3>
				{capitalizeString(level)} • Q{quarter}
			</h3>

			<div
				ref={plotWrapRef}
				className={`
					flex-1 min-h-0 bg-white
					${isMobile ? 'p-0 border-0 rounded-none' : 'p-2 border rounded-xl'}
				`}
			>
				<Plot
					key={plotKey}
					data={[
						{
							type: 'choropleth',
							geojson,
							featureidkey: feature.idKey,
							locations: geoLocations,
							z: zValues,
							zmin: metricRange.min,
							zmax: metricRange.max,
							zauto: false,
							hovertemplate:
								'%{location}<br>' +
								metricNiceName(metric) +
								': %{z:.2f}<extra></extra>',
							colorbar: {
								title: { text: metricNiceName(metric), side: 'bottom' },
								orientation: 'h',
								x: 0.5,
								xanchor: 'center',
								y: colorbarY,
								yanchor: 'bottom',
								len: colorbarLen,
								thickness: colorbarThickness,
								tickformat: '.2f',
							},
						},
					]}
					layout={{
						title: null,
						dragmode: false,
						geo: {
							fitbounds: hasAnyValue ? 'locations' : false,
							showframe: false,
							showcoastlines: false,
							showland: false,

							projection: { type: 'mercator', scale: projectionScale },
						},
						margin,
						autosize: true,
					}}
					config={{
						displayModeBar: false,
						scrollZoom: false,
						doubleClick: false,
						responsive: true,
					}}
					style={{ width: '100%', height: '100%' }}
					useResizeHandler
				/>
			</div>
		</div>
	);
}
