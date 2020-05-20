import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Box, Table, TextInput, Icon, Tag, Avatar } from '@rocket.chat/fuselage';
import { useDebouncedValue, useResizeObserver } from '@rocket.chat/fuselage-hooks';

import PriceDisplay from './PriceDisplay';
import { AppStatus } from './AppStatus';
import { GenericTable, Th } from '../../../app/ui/client/components/GenericTable';
import { useMethod } from '../../contexts/ServerContext';
import { useTranslation } from '../../contexts/TranslationContext';
import { useRoute } from '../../contexts/RouterContext';
import { Apps } from '../../../app/apps/client/orchestrator';
import { AppEvents } from '../../../app/apps/client/communication';
import { handleAPIError } from '../../../app/apps/client/admin/helpers';

const FilterByText = React.memo(({ setFilter, ...props }) => {
	const t = useTranslation();

	const [text, setText] = useState('');

	const handleChange = useCallback((event) => setText(event.currentTarget.value), []);

	useEffect(() => {
		setFilter({ text });
	}, [text]);

	return <Box mb='x16' is='form' onSubmit={useCallback((e) => e.preventDefault(), [])} display='flex' flexDirection='column' {...props}>
		<TextInput placeholder={t('Search_Apps')} addon={<Icon name='magnifier' size='x20'/>} onChange={handleChange} value={text} />
	</Box>;
});

const useResizeInlineBreakpoint = (sizes = [], debounceDelay = 0) => {
	const { ref, borderBoxSize } = useResizeObserver({ debounceDelay });
	const inlineSize = borderBoxSize ? borderBoxSize.inlineSize : 0;
	sizes = useMemo(() => sizes.map((current) => (inlineSize ? inlineSize > current : true)), [inlineSize]);
	return [ref, ...sizes];
};

/* TODO
 *	If order is reversed and search is performed, the result will return in the wrong order, then refresh correctly
 *
 */
function useMarketplaceApps({ debouncedText, debouncedSort, current, itemsPerPage }) {
	const [data, setData] = useState({});
	const ref = useRef();
	ref.current = data;

	const getDataCopy = () => ref.current.slice(0);

	const stringifiedData = JSON.stringify(data);

	const handleAppAddedOrUpdated = useCallback(async (appId) => {
		try {
			const { status, version } = await Apps.getApp(appId);
			const app = await Apps.getAppFromMarketplace(appId, version);
			const updatedData = getDataCopy();
			const index = updatedData.findIndex(({ id }) => id === appId);
			updatedData[index] = {
				...app,
				installed: true,
				status,
				version,
				marketplaceVersion: app.version,
			};
			setData(updatedData);
		} catch (error) {
			handleAPIError(error);
		}
	}, [stringifiedData, setData]);

	const handleAppRemoved = useCallback((appId) => {
		const updatedData = getDataCopy();
		const app = updatedData.find(({ id }) => id === appId);
		if (!app) {
			return;
		}
		delete app.installed;
		delete app.status;
		app.version = app.marketplaceVersion;

		setData(updatedData);
	}, [stringifiedData, setData]);

	const handleAppStatusChange = useCallback(({ appId, status }) => {
		const updatedData = getDataCopy();
		const app = updatedData.find(({ id }) => id === appId);

		if (!app) {
			return;
		}
		app.status = status;
		setData(updatedData);
	}, [stringifiedData, setData]);

	useEffect(() => {
		(async () => {
			try {
				const marketAndInstalledApps = await Promise.all([Apps.getAppsFromMarketplace(), Apps.getApps()]);
				const appsData = marketAndInstalledApps[0].map((app) => {
					const installedApp = marketAndInstalledApps[1].find(({ id }) => id === app.id);
					if (!installedApp) {
						return {
							...app,
							status: undefined,
							marketplaceVersion: app.version,
						};
					}

					return {
						...app,
						installed: true,
						status: installedApp.status,
						version: installedApp.version,
						marketplaceVersion: app.version,
					};
				});

				setData(appsData.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1)));

				Apps.getWsListener().registerListener(AppEvents.APP_ADDED, handleAppAddedOrUpdated);
				Apps.getWsListener().registerListener(AppEvents.APP_UPDATED, handleAppAddedOrUpdated);
				Apps.getWsListener().registerListener(AppEvents.APP_REMOVED, handleAppRemoved);
				Apps.getWsListener().registerListener(AppEvents.APP_STATUS_CHANGE, handleAppStatusChange);
			} catch (e) {
				handleAPIError(e);
			}
		})();

		return () => {
			Apps.getWsListener().unregisterListener(AppEvents.APP_ADDED, handleAppAddedOrUpdated);
			Apps.getWsListener().unregisterListener(AppEvents.APP_UPDATED, handleAppAddedOrUpdated);
			Apps.getWsListener().unregisterListener(AppEvents.APP_REMOVED, handleAppRemoved);
			Apps.getWsListener().unregisterListener(AppEvents.APP_STATUS_CHANGE, handleAppStatusChange);
		};
	}, []);

	const filteredValues = useMemo(() => {
		if (data.length) {
			let filtered = debouncedSort[1] === 'asc' ? data : data.reverse();

			filtered = debouncedText ? filtered.filter((app) => app.name.toLowerCase().indexOf(debouncedText.toLowerCase()) > -1) : filtered;

			const filteredLength = filtered.length;

			const sliceStart = current > filteredLength ? 0 : current;

			filtered = filtered.slice(sliceStart, current + itemsPerPage);

			return [filtered, filteredLength];
		}
		return [null, 0];
	}, [debouncedText, debouncedSort[1], stringifiedData, current, itemsPerPage]);

	return [...filteredValues];
}

const objectFit = { objectFit: 'contain' };

export function MarketplaceTable({ setModal }) {
	const t = useTranslation();
	const [ref, isBig] = useResizeInlineBreakpoint([700], 200);

	const [params, setParams] = useState({ text: '', current: 0, itemsPerPage: 25 });
	const [sort, setSort] = useState(['name', 'asc']);

	const debouncedText = useDebouncedValue(params.text, 500);
	const debouncedSort = useDebouncedValue(sort, 200);

	const [data, total] = useMarketplaceApps({ debouncedSort, debouncedText, ...params });

	const getLoggedInCloud = useMethod('cloud:checkUserLoggedIn');
	const isLoggedIn = getLoggedInCloud();

	const router = useRoute('admin-apps');

	const onClick = (_id) => () => router.push({
		context: 'details',
		id: _id,
	});

	const onHeaderClick = useCallback((id) => {
		const [sortBy, sortDirection] = sort;

		if (sortBy === id) {
			setSort([id, sortDirection === 'asc' ? 'desc' : 'asc']);
			return;
		}
		setSort([id, 'asc']);
	}, [sort]);

	const header = useMemo(() => [
		<Th key={'name'} direction={sort[1]} active={sort[0] === 'name'} onClick={onHeaderClick} sort='name' w={isBig ? 'x280' : 'x240'}>{t('Name')}</Th>,
		<Th key={'details'}>{t('Details')}</Th>,
		<Th key={'price'}>{t('Price')}</Th>,
		isBig && <Th key={'status'}>{t('Status')}</Th>,
	].filter(Boolean), [sort, isBig]);

	const renderRow = useCallback((props) => {
		const {
			author: { name: authorName },
			name,
			id,
			description,
			categories,
			purchaseType,
			pricingPlans,
			price,
			iconFileData,
		} = props;

		const [showStatus, setShowStatus] = useState(false);

		const toggleShow = (state) => () => setShowStatus(state);
		const handler = onClick(id);

		return useMemo(() => <Table.Row key={id} onKeyDown={handler} onClick={handler} tabIndex={0} role='link' onMouseEnter={toggleShow(true)} onMouseLeave={toggleShow(false)} >
			<Table.Cell withTruncatedText display='flex' flexDirection='row'>
				<Avatar style={objectFit} size='x40' mie='x8' alignSelf='center' url={`data:image/png;base64,${ iconFileData }`}/>
				<Box display='flex' flexDirection='column' alignSelf='flex-start'>
					<Box color='default' fontScale='p2'>{name}</Box>
					<Box color='default' fontScale='p2'>{`${ t('By') } ${ authorName }`}</Box>
				</Box>
			</Table.Cell>
			<Table.Cell>
				<Box display='flex' flexDirection='column'>
					<Box color='default' withTruncatedText>{description}</Box>
					{categories && <Box color='hint' display='flex' flex-direction='row' withTruncatedText>
						{categories.map((current) => <Tag disabled key={current} mie='x4'>{current}</Tag>)}
					</Box>}
				</Box>
			</Table.Cell>
			<Table.Cell >
				<PriceDisplay {...{ purchaseType, pricingPlans, price }} />
			</Table.Cell>
			{isBig && <Table.Cell withTruncatedText>
				<AppStatus app={props} show={showStatus} setModal={setModal} isLoggedIn={isLoggedIn}/>
			</Table.Cell>}
		</Table.Row>, [id, showStatus, JSON.stringify(props)]);
	}, []);

	return <GenericTable
		ref={ref}
		FilterComponent={FilterByText}
		header={header}
		renderRow={renderRow}
		results={data}
		total={total}
		setParams={setParams}
		params={params}
	/>;
}

export default MarketplaceTable;
