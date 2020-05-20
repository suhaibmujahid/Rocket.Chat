import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Icon, Throbber } from '@rocket.chat/fuselage';

import { Modal } from '../../components/basic/Modal';
import { useTranslation } from '../../contexts/TranslationContext';
import { appButtonProps, appStatusSpanProps, handleAPIError, warnStatusChange } from '../../../app/apps/client/admin/helpers';
import { Apps } from '../../../app/apps/client/orchestrator';

const iframeMsgListener = (confirm, cancel) => (e) => {
	let data;
	try {
		data = JSON.parse(e.data);
	} catch (e) {
		return;
	}

	if (data.result) {
		confirm(data);
	} else {
		cancel();
	}
};

const IframeModal = ({ url, confirm, cancel, ...props }) => {
	useEffect(() => {
		const listener = iframeMsgListener(confirm, cancel);
		window.addEventListener('message', listener);

		return () => window.removeEventListener('message', listener);
	}, []);
	return <Modal padding='x12' minHeight='x400' {...props}>
		<iframe style={{ border: 'none', height: '100%', width: '100%' }} src={url}/>
	</Modal>;
};

const installApp = async ({ id, name, version }, callback) => {
	try {
		const { status } = await Apps.installApp(id, version);
		warnStatusChange(name, status);
	} catch (error) {
		handleAPIError(error);
	} finally {
		callback();
	}
};

const actions = {
	purchase: installApp,
	install: installApp,
	update: async ({ id, name, version }, callback) => {
		try {
			const { status } = await Apps.updateApp(id, version);
			warnStatusChange(name, status);
		} catch (error) {
			handleAPIError(error);
		} finally {
			callback();
		}
	},
};

export const AppStatus = React.memo(({ app, show = true, setModal, isLoggedIn, ...props }) => {
	const t = useTranslation();
	const [loading, setLoading] = useState();

	const button = appButtonProps(app);
	const status = !button && appStatusSpanProps(app);

	const { id } = app;

	const confirmAction = () => {
		actions[button.action](app, () => {
			setLoading(false);
			setModal(null);
		});
	};

	const openModal = async () => {
		setLoading(true);
		try {
			const data = await Apps.buildExternalUrl(app.id, app.purchaseType, false);

			setModal(() => <IframeModal url={data.url} cancel={() => setModal(null)} confirm={confirmAction}/>);
		} catch (error) {
			handleAPIError(error);
		}
	};

	const openLoginPrompt = () => setModal();

	const handleClick = useCallback((e) => {
		e.preventDefault();
		e.stopPropagation();
		isLoggedIn ? openModal() : openLoginPrompt();
	}, [id, isLoggedIn]);

	return <Box display={show || status || loading ? 'box' : 'none'}>
		{button && <Button primary disabled={loading} onClick={handleClick}>
			{loading && <Throbber />}
			{!loading && button.icon && <Icon name={button.icon} />}
			{!loading && t(button.label)}
		</Button>}
		{status && <Box color={status.label === 'Disabled' ? 'warning' : 'hint'}>
			<Icon size='x20' name={status.icon} mie='x4'/>
			{t(status.label)}
		</Box>}
	</Box>;
});
