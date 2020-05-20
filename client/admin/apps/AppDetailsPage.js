import React, { useState, useEffect } from 'react';
import { Button, ButtonGroup, Icon, Avatar, Box, Divider, Chip, Margins } from '@rocket.chat/fuselage';

import Page from '../../components/basic/Page';
import { useMethod } from '../../contexts/ServerContext';
import PriceDisplay from './PriceDisplay';
import { AppStatus } from './AppStatus';
import { useTranslation } from '../../contexts/TranslationContext';
import { Apps } from '../../../app/apps/client/orchestrator';

const objectFit = { objectFit: 'contain' };

const useSpecificApp = (id) => {
	const [data, setData] = useState({});
	useEffect(() => {
		(async () => {
			const app = await Apps.getAppFromMarketplace(id);

			setData(app);
		})();
	}, [id]);

	return data;
};

export default function AppDetailsPage({ id }) {
	const t = useTranslation();
	const data = useSpecificApp(id);
	const [modal, setModal] = useState(null);

	const {
		iconFileData = '',
		name,
		author: { name: authorName, homepage, support } = {},
		description,
		categories = [],
		version,
		price,
		purchaseType,
		pricingPlans,
	} = data;

	const getLoggedInCloud = useMethod('cloud:checkUserLoggedIn');
	const isLoggedIn = getLoggedInCloud();

	return <><Page flexDirection='column'>
		<Page.Header title={t('App_Details')}>
			<ButtonGroup>
				<Button primary disabled>
					{t('Save_changes')}
				</Button>
				<Button>
					<Icon name='back'/>
					{t('Back')}
				</Button>
			</ButtonGroup>
		</Page.Header>
		<Page.Content maxWidth='x600' w='full' alignSelf='center'>
			<Box display='flex' flexDirection='row' mbe='x20'>
				<Avatar style={objectFit} size='x120' mie='x20' url={`data:image/png;base64,${ iconFileData }`}/>
				<Box display='flex' flexDirection='column' justifyContent='space-between'>
					<Box fontScale='h1' fontWeight='500'>{name}</Box>
					<Box display='flex' flexDirection='row' color='hint' alignItems='center'>
						<Box fontScale='p2' mie='x4'>{`${ t('By') } ${ authorName }`}</Box>
						|
						<Box mis= 'x4'>{`${ t('Version') } ${ version }`}</Box>
					</Box>
					<Box display='flex' flexDirection='row' alignItems='center'>
						<AppStatus app={data} setModal={setModal} isLoggedIn={isLoggedIn}/>
						<PriceDisplay mis='x12' purchaseType={purchaseType} pricingPlans={pricingPlans} price={price} showType={false}/>
					</Box>
				</Box>
			</Box>
			<Divider />
			<Box display='flex' flexDirection='column'>

				<Margins block='x12'>
					<Box fontScale='h1' textTransform='uppercase'>{t('Categories')}</Box>
					<Box display='flex' flexDirection='row'>
						{categories && categories.map((current) => <Chip key={current} textTransform='uppercase' mie='x8'><Box color='hint'>{current}</Box></Chip>)}
					</Box>

					<Box fontScale='h1' textTransform='uppercase'>{t('Contact')}</Box>
					<Box display='flex' flexDirection='row'>
						<Box display='flex' flexDirection='column' mie='x12'>
							<Box fontScale='s1' color='hint' textTransform='uppercase'>{t('Author_Site')}</Box>
							<Box withRichContent><a href={homepage}>{homepage}</a></Box>
						</Box>
						<Box display='flex' flexDirection='column'>
							<Box fontScale='s1' color='hint' textTransform='uppercase'>{t('Support')}</Box>
							<Box withRichContent><a href={support}>{support}</a></Box>
						</Box>
					</Box>

					<Box fontScale='h1' textTransform='uppercase'>{t('Details')}</Box>
					<Box display='flex' flexDirection='row'>{description}</Box>
				</Margins>

			</Box>
		</Page.Content>
	</Page>{modal}</>;
}
