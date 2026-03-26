import {
	Button,
	DateTimePicker,
	Dropdown,
	SelectControl,
	ToolbarButton,
	ToolbarGroup,
} from '@wordpress/components';
import { calendar } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

const DATE_PRESETS_FROM = [
	{ label: "don't filter", value: '' },
	{ label: 'last week', value: 'last-1-week' },
	{ label: 'last 10 days', value: 'last-10-days' },
	{ label: 'last 2 weeks', value: 'last-2-weeks' },
	{ label: 'last month', value: 'last-1-month' },
	{ label: 'last year', value: 'last-1-year' },
	{ label: 'a specific date', value: 'specific' },
];

const DATE_PRESETS_TO = [
	{ label: "don't filter", value: '' },
	{ label: 'last 30 minutes', value: 'last-30-minutes' },
	{ label: 'last hour', value: 'last-1-hour' },
	{ label: 'last 2 hours', value: 'last-2-hour' },
	{ label: 'last day', value: 'last-1-day' },
	{ label: 'a specific date', value: 'specific' },
];

const formatDateLabel = ( value ) => {
	try {
		const d = new Date( value );
		return isNaN( d ) ? value : d.toLocaleString();
	} catch {
		return value;
	}
};

const buildDateOptions = ( value, presets ) =>
	value &&
	! presets.find( ( o ) => o.value === value ) &&
	value !== 'specific'
		? [ ...presets, { label: formatDateLabel( value ), value } ]
		: presets;

/**
 * Toolbar group for selecting the date range filter.
 *
 * @param {object}   props
 * @param {object}   props.dateRange            { from: string, to: string }
 * @param {Function} props.onChangeDateRange    Called with new { from, to } object.
 */
export default function TimeToolbarGroup( { dateRange, onChangeDateRange } ) {
	const fromValue = dateRange?.from || '';
	const toValue = dateRange?.to || '';

	const isCustomFrom =
		fromValue === 'specific' ||
		( fromValue &&
			! DATE_PRESETS_FROM.find( ( o ) => o.value === fromValue ) );
	const isCustomTo =
		toValue === 'specific' ||
		( toValue && ! DATE_PRESETS_TO.find( ( o ) => o.value === toValue ) );

	return (
		<ToolbarGroup>
			<Dropdown
				popoverProps={ { placement: 'bottom-start' } }
				renderToggle={ ( { isOpen, onToggle } ) => (
					<ToolbarButton
						label={ __( 'Time filter' ) }
						icon={ calendar }
						onClick={ onToggle }
						isPressed={ isOpen }
					>
						{ __( 'Time' ) }
					</ToolbarButton>
				) }
				renderContent={ () => (
					<div
						style={ {
							padding: '12px',
							minWidth: '260px',
							display: 'flex',
							flexDirection: 'column',
							gap: '12px',
						} }
					>
						<SelectControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Show points from' ) }
							value={ fromValue }
							options={ buildDateOptions(
								fromValue,
								DATE_PRESETS_FROM
							) }
							onChange={ ( value ) =>
								onChangeDateRange( {
									...dateRange,
									from: value,
								} )
							}
						/>
						{ isCustomFrom && (
							<Dropdown
								popoverProps={ { placement: 'right-start' } }
								renderToggle={ ( { isOpen, onToggle } ) => (
									<Button
										variant="secondary"
										size="small"
										onClick={ onToggle }
										isPressed={ isOpen }
									>
										{ fromValue !== 'specific'
											? formatDateLabel( fromValue )
											: __( 'Pick date…' ) }
									</Button>
								) }
								renderContent={ () => (
									<DateTimePicker
										currentDate={
											fromValue !== 'specific'
												? fromValue
												: new Date()
										}
										onChange={ ( date ) =>
											onChangeDateRange( {
												...dateRange,
												from: date,
											} )
										}
									/>
								) }
							/>
						) }
						<SelectControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Show points to' ) }
							value={ toValue }
							options={ buildDateOptions(
								toValue,
								DATE_PRESETS_TO
							) }
							onChange={ ( value ) =>
								onChangeDateRange( {
									...dateRange,
									to: value,
								} )
							}
						/>
						{ isCustomTo && (
							<Dropdown
								popoverProps={ { placement: 'right-start' } }
								renderToggle={ ( { isOpen, onToggle } ) => (
									<Button
										variant="secondary"
										size="small"
										onClick={ onToggle }
										isPressed={ isOpen }
									>
										{ toValue !== 'specific'
											? formatDateLabel( toValue )
											: __( 'Pick date…' ) }
									</Button>
								) }
								renderContent={ () => (
									<DateTimePicker
										currentDate={
											toValue !== 'specific'
												? toValue
												: new Date()
										}
										onChange={ ( date ) =>
											onChangeDateRange( {
												...dateRange,
												to: date,
											} )
										}
									/>
								) }
							/>
						) }
					</div>
				) }
			/>
		</ToolbarGroup>
	);
}
