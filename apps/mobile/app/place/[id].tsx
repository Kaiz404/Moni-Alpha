import { useValue } from '@legendapp/state/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Linking, Platform, ScrollView, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUniwind } from 'uniwind';

import { MapHeader } from '@/components/map/map-header';
import { mapStyles } from '@/components/map/map-style';
import {
  MoniNoticed,
  PendingHere,
  PlaceHero,
  WhatYouBought,
} from '@/components/map/place-detail';
import { usePlaceSources } from '@/components/map/use-places';
import { NotFound } from '@/components/ui/empty-tile';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list-card';
import { Page } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TransactionRow } from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { getProposalLocationSnapshot } from '@/lib/ai/proposal-location-cache';
import { formatMoney } from '@/lib/finance/format-money';
import { merchantName } from '@/lib/finance/merchant-name';
import {
  groupPlaces,
  isAtPlace,
  placeRange,
  placeRegular,
  placesTotal,
  sharePercent,
  spanLabel,
  type Place,
} from '@/lib/finance/places';
import { pendingProposals$ } from '@/lib/finance/selectors';
import { listMerchantAliases } from '@/lib/supabase/merchant-aliases';
import { tid } from '@/lib/test-ids';
import { transactionRow } from '@/lib/transactions/row';

/** XM-Detail's map strip; the sheet starts 28 above its bottom edge. */
const MAP_HEIGHT = 240;
const SHEET_OVERLAP = 28;

async function openInMaps(place: Place) {
  const label = encodeURIComponent(place.name);
  const at = `${place.latitude},${place.longitude}`;
  const app = Platform.OS === 'ios' ? `http://maps.apple.com/?q=${label}&ll=${at}` : `geo:0,0?q=${at}(${label})`;
  try {
    await Linking.openURL(app);
  } catch {
    await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${at}`);
  }
}

export default function PlaceScreen() {
  const params = useLocalSearchParams<{ id: string; range?: string }>();
  const insets = useSafeAreaInsets();
  const tokens = useThemeTokens();
  const dark = useUniwind().theme === 'dark';
  const { userId, currency, transactions, lookups, categoryLook } = usePlaceSources();
  const proposals = useValue(pendingProposals$(userId));
  const aliases = useValue(() => (userId ? listMerchantAliases(userId) : []));

  const range = useMemo(() => placeRange(params.range, new Date()), [params.range]);
  const places = useMemo(() => groupPlaces(transactions, { currency, range }), [transactions, currency, range]);
  const place = places.find((candidate) => candidate.id === params.id) ?? null;
  const nameOf = (raw: string | null) => merchantName(raw, aliases);

  const pendingHere = useMemo(
    () =>
      place
        ? proposals.filter((proposal) => {
            const at = getProposalLocationSnapshot(proposal.id);
            return proposal.currency === currency && at !== null && isAtPlace(place, at);
          })
        : [],
    [place, proposals, currency],
  );

  if (!place) {
    return (
      <Page
        screen="map"
        kind="pushed"
        title="Place"
      >
        <NotFound
          icon="map-marker-off-outline"
          title="Nothing here in this range"
          body="This place has no payments for the dates you picked."
        />
      </Page>
    );
  }

  const regular = placeRegular(place);
  const regularWallet = regular?.walletId ? lookups.walletNames[regular.walletId] : null;
  const noticed = regular
    ? `${nameOf(regular.merchant)} is your regular. ${regular.visits} visits ${range.words}, about ${formatMoney(regular.averageMinor, currency, { whole: true })} each${regularWallet ? `, always paid with ${regularWallet}` : ''}.`
    : null;
  const lead = categoryLook(place.categories[0]?.categoryId ?? null);

  return (
    <View className="flex-1 bg-canvas">
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          pointerEvents="none"
          style={{ height: MAP_HEIGHT }}
        >
          <MapView
            provider={PROVIDER_GOOGLE}
            liteMode
            style={{ flex: 1 }}
            customMapStyle={dark ? mapStyles.dark : mapStyles.light}
            initialRegion={{
              latitude: place.latitude,
              longitude: place.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            toolbarEnabled={false}
          />
          <View className="absolute inset-0 items-center justify-center">
            <View className="h-[34px] flex-row items-center gap-1.5 rounded-full bg-primary pl-1 pr-3">
              <View
                className="h-[26px] w-[26px] items-center justify-center rounded-full bg-sand"
                style={lead.color ? { backgroundColor: lead.color } : undefined}
              >
                <IconSymbol
                  name={lead.icon}
                  size={15}
                  color={lead.color ? tokens.onPastel : tokens.foreground}
                />
              </View>
              <Text
                className="text-[15px] leading-[20px] font-display-bold text-primary-foreground"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {formatMoney(place.totalMinor, currency, { whole: true })}
              </Text>
            </View>
            <View className="mt-2 h-3 w-3 rounded-full border-2 border-card bg-primary" />
          </View>
        </View>
        <View
          className="gap-section rounded-t-sheet bg-canvas px-5 pb-8 pt-6"
          style={{ marginTop: -SHEET_OVERLAP }}
        >
          <PlaceHero
            heading={`Spent here ${range.words}`}
            totalMinor={place.totalMinor}
            count={place.count}
            days={place.days}
            currency={currency}
            top={places[0]?.id === place.id && places.length > 1}
            share={sharePercent(place.totalMinor, placesTotal(places))}
          />
          <PendingHere
            proposals={pendingHere}
            nameOf={nameOf}
            walletName={(walletId) => (walletId ? (lookups.walletNames[walletId] ?? null) : null)}
            onReview={(proposal) => router.push({ pathname: '/proposal/[id]', params: { id: proposal.id } })}
          />
          <WhatYouBought
            categories={place.categories}
            totalMinor={place.totalMinor}
            currency={currency}
            look={categoryLook}
          />
          {noticed ? (
            <MoniNoticed
              sentence={noticed}
              onAsk={() =>
                router.push({
                  pathname: '/chat',
                  params: { draft: `What do I usually spend at ${place.name}?` },
                })
              }
            />
          ) : null}
          <View className="gap-3.5">
            <View className="flex-row items-baseline justify-between">
              <Text
                variant="sectionTitle"
                className="text-foreground"
                accessibilityRole="header"
              >
                Payments
              </Text>
              <Text
                variant="meta"
                className="text-muted"
              >
                Newest first
              </Text>
            </View>
            <ListCard>
              {place.transactions.map((transaction) => {
                const row = transactionRow(transaction, lookups);
                return (
                  <TransactionRow
                    key={transaction.id}
                    testID={tid('map', 'place', 'payment', transaction.id)}
                    row={{ ...row, title: nameOf(transaction.merchant) ?? row.title }}
                    metaLead="date"
                    onPress={() =>
                      router.push({ pathname: '/transaction/[id]', params: { id: transaction.id } })
                    }
                  />
                );
              })}
            </ListCard>
            <Button
              testID={tid('map', 'place', 'see-in-activity')}
              label="See these in Activity"
              variant="tertiary"
              icon="chevron-right"
              className="self-center"
              onPress={() => router.dismissTo({ pathname: '/activity', params: { placeId: place.id } })}
            />
          </View>
        </View>
      </ScrollView>
      <MapHeader
        scope="place"
        title={place.name}
        subtitle={[place.area, spanLabel(range)].filter(Boolean).join(' · ')}
        action={{
          name: 'directions',
          icon: 'directions',
          label: 'Open in Maps',
          onPress: () => void openInMaps(place),
        }}
      />
    </View>
  );
}
