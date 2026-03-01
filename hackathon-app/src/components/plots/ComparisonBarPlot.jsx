import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { capitalizeString } from '../../utils/capitalizeString';

import {
	metricNiceName,
	formatDeltaLabel,
	deltaStatus,
	formatMetricValue,
} from '../../utils/metricHelpers';

export default function ComparisonBarPlot({
	level,
	quarter,
	geography,
	metric,
	getComparison,
}) {
	const { ukAvg, selected, delta } = getComparison({
		level,
		quarter,
		geography,
		metric,
	});

	const noData = ukAvg == null || selected == null;
	const isNational = level === 'national';

	const status = useMemo(
		() => (noData || isNational ? null : deltaStatus(metric, delta)),
		[noData, isNational, metric, delta],
	);

	const deltaText = useMemo(
		() =>
			noData || isNational
				? ''
				: formatDeltaLabel(metric, delta, { baselineLabel: 'UK' }),
		[noData, isNational, metric, delta],
	);

	const traces = useMemo(() => {
		if (noData || isNational) return [];

		const metricLabel = metricNiceName(metric);

		return [
			{
				type: 'bar',
				x: [geography, 'UK Average'],
				y: [selected, ukAvg],
				marker: {
					color: [
						'#f97316', // 🟧 Orange (Geography)
						'#2563eb', // 🔵 Blue (UK Average)
					],
				},
				hovertemplate:
					'%{x}<br>' + `${metricLabel}: %{y:.2f}` + '<extra></extra>',
			},
		];
	}, [noData, isNational, geography, selected, ukAvg, metric]);

	const layout = useMemo(() => {
		const metricLabel = metricNiceName(metric);

		return {
			height: 320,
			margin: { l: 50, r: 10, t: 10, b: 45 },
			xaxis: {
				type: 'category',
			},
			yaxis: {
				title: metricLabel,
				tickformat: '.2f',
				rangemode: 'tozero',
			},
			legend: { orientation: 'h', y: -0.2 },
			dragmode: false,
		};
	}, [metric]);

	const badgeClass = useMemo(() => {
		if (!status) return 'bg-gray-50 text-gray-700 border-gray-200';
		return status === 'better'
			? 'bg-green-50 text-green-700 border-green-200'
			: status === 'worse'
				? 'bg-red-50 text-red-700 border-red-200'
				: 'bg-gray-50 text-gray-700 border-gray-200';
	}, [status]);

	const badgeText = useMemo(() => {
		if (!status) return '';
		return status === 'better'
			? 'Better than UK'
			: status === 'worse'
				? 'Worse than UK'
				: 'About the same';
	}, [status]);

	// ✅ Remount on slicer change (most reliable)
	const plotKey = `${level}-${quarter}-${metric}-${geography}`;

	if (noData) {
		return (
			<div className='bg-white/70 rounded-2xl shadow p-4'>
				<div className='text-sm opacity-70'>Only available for Country and Region</div>
			</div>
		);
	}

	if (isNational) {
		return (
			<div className='bg-white/70 rounded-2xl shadow p-4'>
				<div className='text-sm opacity-70'>
					Cannot show comparison for national level.
				</div>
			</div>
		);
	}

	return (
		<div className='bg-white/70 rounded-2xl shadow p-4'>
			<div className='flex items-center justify-between mb-2 md:flex-row flex-col gap-2'>
				<div>
					<h2 className='font-semibold'>
						Q{quarter} {metricNiceName(metric)} Comparison
					</h2>
					<h3>{geography} vs Great Britain</h3>
				</div>

				<div className={`text-xs px-2 py-1 rounded-full border ${badgeClass}`}>
					{badgeText} · {deltaText}
				</div>
			</div>



			<div className="h-80 rounded-xl border overflow-hidden bg-white">
				<Plot
					key={plotKey}
					data={traces}
					layout={layout}
					revision={plotKey}
					useResizeHandler
					config={{
						displayModeBar: false,
						responsive: true,
						scrollZoom: false,
						doubleClick: false
					}}
					style={{ width: '98%', height: '98%' }}
				/>
			</div>

		</div>
	);
}
