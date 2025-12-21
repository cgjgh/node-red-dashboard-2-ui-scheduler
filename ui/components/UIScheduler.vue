<!-- eslint-disable vue/valid-v-slot -->
<!-- eslint-disable vuetify/no-deprecated-components -->
<template class="px-0 py-2 main">
    <v-container class="pa-0 main" style="border: 1.5px solid grey; border-radius: 10px">
        <v-toolbar border color="navigation-background" rounded="lg">
            <v-toolbar-title
                :class="['truncate-text', { 'text-body-1': selectedTopic !== 'All' && $vuetify.display.xs }]"
                :style="{ margin: (selectedTopic !== 'All' && $vuetify.display.xs) ? '2px !important' : '20px' }"
            >
                {{ label }}
            </v-toolbar-title>
            <v-select
                v-if="props.uiOptionTopic" v-model="selectedTopic" :items="['All', ...uniqueTopics]"
                :label="t('topic')" style="max-width: fit-content" rounded="lg" variant="solo-inverted"
                @update:model-value="filterSchedules"
            />
            <v-switch
                v-if="selectedTopic !== 'All'" v-model="anyScheduleEnabled" color="primary" hide-details
                class="pl-3" @click.stop="toggleAllSchedules"
            />

            <v-btn id="nrdb2-ui-scheduler-new-schedule-button" @click="openDialog()">
                <v-icon>mdi-plus</v-icon>
            </v-btn>
            <v-menu>
                <template #activator="{ props: menuProps }">
                    <v-btn v-if="isUpdateAvailable" variant="plain" density="compact" v-bind="menuProps" max-width="20">
                        <v-badge color="red" floating dot density="compact">
                            <v-icon icon="mdi-dots-vertical" />
                        </v-badge>
                    </v-btn>
                    <v-btn v-else variant="plain" density="compact" v-bind="menuProps" icon="mdi-dots-vertical" />
                </template>

                <v-list>
                    <v-list-item
                        v-for="(item, i) in menuItems" :key="i" :value="item.value"
                        @click="handleMenuItemClick(item)"
                    >
                        <template #prepend>
                            <v-badge v-if="item.value === 'updates' && isUpdateAvailable" color="red" dot floating>
                                <v-icon
                                    :color="(item.value === 'updates' && isUpdateAvailable) ? 'orange' : item.color"
                                    :icon="item.icon"
                                />
                            </v-badge>
                            <v-icon
                                v-else
                                :color="(item.value === 'updates' && isUpdateAvailable) ? 'orange' : item.color"
                                :icon="item.icon"
                            />
                        </template>
                        <v-list-item-title
                            :color="(item.value === 'updates' && isUpdateAvailable) ? 'orange' : 'primary'"
                        >
                            {{
                                item.label
                            }}
                        </v-list-item-title>
                    </v-list-item>
                </v-list>
            </v-menu>
        </v-toolbar>
        <v-data-table
            v-model:expanded="expanded" :headers="filteredHeaders" :items="filteredSchedules"
            hide-default-footer density="compact" :show-expand="!$vuetify.display.xs" item-value="name"
            :expand="expandedItem" items-per-page @click:row="handleRowClick"
        >
            <template #item.rowNumber="{ item }">
                <v-badge v-if="item.invalid" color="error">
                    <!-- Badge slot for the error icon -->
                    <template #badge>
                        <v-icon size="small">mdi-alert</v-icon>
                    </template>
                    <v-chip
                        :color="item.active === undefined ? 'gray' : (item.active ? 'green' : 'red')"
                        density="compact"
                    >
                        {{ item.rowNumber }}
                    </v-chip>
                </v-badge>
                <v-chip
                    v-else :color="item.active === undefined ? 'gray' : (item.active ? 'green' : 'red')"
                    density="compact"
                >
                    {{ item.rowNumber }}
                </v-chip>
            </template>

            <template #item.name="{ item }">
                <v-badge v-if="item.invalid" color="error">
                    <!-- Badge slot for the error icon -->
                    <template #badge>
                        <v-icon size="small">mdi-alert</v-icon>
                    </template>
                    <v-chip :color="item.active ? 'green' : 'red'">
                        {{ item.name }}
                    </v-chip>
                </v-badge>

                <!-- Otherwise, simply render the chip without a badge -->
                <v-chip v-else :color="item.active === undefined ? 'gray' : (item.active ? 'green' : 'red')">
                    {{ item.name }}
                </v-chip>
            </template>
            <template #item.action="{ item }">
                <div style="padding-right: 0; margin-right: 0; width: fit-content">
                    <template v-if="item.isStatic">
                        <v-icon :color="item.enabled ? 'green' : 'red'">
                            {{ item.enabled ? 'mdi-check' : 'mdi-close' }}
                        </v-icon>
                    </template>
                    <template v-else>
                        <v-switch
                            id="nrdb2-ui-scheduler-schedule-enable-switch" v-model="item.enabled"
                            :disabled="item.invalid" color="green" hide-details @click.stop="toggleSchedule(item)"
                        />
                    </template>
                </div>
            </template>

            <template #expanded-row="{ columns, item }">
                <v-slide-x-transition appear>
                    <tr v-if="item">
                        <td :colspan="columns.length" class="px-0">
                            <v-card>
                                <v-progress-linear
                                    v-if="item.active" :color="progressColor(item)"
                                    :model-value="progressValue(item)" stream rounded :height="6"
                                />
                                <v-card-title class="d-flex align-items-center justify-space-between pb-4">
                                    <div v-if="item && item.name">
                                        {{ item.name }}
                                    </div>
                                    <div v-else>
                                        <em>No item selected</em>
                                    </div>
                                    <v-btn
                                        v-if="item" id="nrdb2-ui-scheduler-edit-schedule-button" icon color="primary"
                                        :disabled="item.isStatic || item.readonly" @click="editSchedule(item)"
                                    >
                                        <v-icon>mdi-pencil</v-icon>
                                    </v-btn>
                                </v-card-title>
                                <v-card-text>
                                    <v-row>
                                        <v-list>
                                            <v-list-subheader>{{ t('eventDetails') }}</v-list-subheader>

                                            <v-list-item v-if="item.topic" class="prepend-icon-spacing">
                                                <template #prepend>
                                                    <v-icon>mdi-sitemap-outline</v-icon>
                                                </template>
                                                <v-list-item-title>{{ t('topic') }}</v-list-item-title>
                                                <v-list-item-subtitle>{{ item.topic }}</v-list-item-subtitle>
                                            </v-list-item>

                                            <v-list-item v-if="item.period" class="prepend-icon-spacing">
                                                <template #prepend>
                                                    <v-icon>mdi-calendar-expand-horizontal</v-icon>
                                                </template>
                                                <v-list-item-title>{{ t('period') }}</v-list-item-title>
                                                <v-list-item-subtitle>
                                                    {{ t(item.period)
                                                    }}
                                                </v-list-item-subtitle>
                                            </v-list-item>

                                            <v-list-item class="prepend-icon-spacing">
                                                <template #prepend>
                                                    <v-icon>mdi-email-arrow-right-outline</v-icon>
                                                </template>
                                                <v-list-item-title>{{ t('output') }}</v-list-item-title>
                                                <v-list-item-subtitle class="pb-2">
                                                    <template
                                                        v-if="(item.timespan !== false) && item.payloadType === 'true_false'"
                                                    >
                                                        <v-chip density="compact" color="green">{{ t('true') }}</v-chip>
                                                        <span> {{ t('onStart') }} </span>
                                                        <v-chip density="compact" color="red">{{ t('false') }}</v-chip>
                                                        <span> {{ t('onEnd') }} </span>
                                                    </template>
                                                    <template v-else-if="item.payloadValue === true">
                                                        <v-chip density="compact" color="green">{{ t('true') }}</v-chip>
                                                    </template>
                                                    <template v-else-if="item.payloadValue === false">
                                                        <v-chip density="compact" color="red">{{ t('false') }}</v-chip>
                                                    </template>
                                                    <template v-else>
                                                        <v-chip density="compact" color="blue">
                                                            {{ t('custom')
                                                            }}
                                                        </v-chip>
                                                    </template>
                                                </v-list-item-subtitle>
                                            </v-list-item>

                                            <v-divider />

                                            <v-list-subheader
                                                v-if="item.period || item.timespan !== false || item.solarDays"
                                            >
                                                {{ t('timeDetails') }}
                                            </v-list-subheader>

                                            <v-list-item v-if="item.month" class="prepend-icon-spacing">
                                                <template #prepend>
                                                    <v-icon>mdi-calendar-month</v-icon>
                                                </template>
                                                <v-list-item-title>{{ t('month') }}</v-list-item-title>
                                                <v-list-item-subtitle>{{ mapMonth(item.month) }}</v-list-item-subtitle>
                                            </v-list-item>

                                            <v-list-item v-if="item.days" lines="3" class="prepend-icon-spacing">
                                                <template #prepend>
                                                    <v-icon>mdi-calendar-range</v-icon>
                                                </template>
                                                <v-list-item-title>{{ t('days') }}</v-list-item-title>
                                                <v-list-item-subtitle class="pb-2">
                                                    <v-chip
                                                        v-for="(day, index) in item.days" :key="index"
                                                        :color="['monthly', 'yearly'].includes(item.period) ? 'blue' : getChipColor(day)"
                                                        density="compact"
                                                    >
                                                        <span v-if="['monthly', 'yearly'].includes(item.period)">
                                                            {{ day === 'Last' ? t('lastDay') : day }}
                                                        </span>
                                                        <span v-else>
                                                            {{ mapDayOfWeek(day).slice(0, 3) }}
                                                        </span>
                                                    </v-chip>
                                                </v-list-item-subtitle>
                                            </v-list-item>

                                            <v-list-item v-if="item.solarDays" lines="3" class="prepend-icon-spacing">
                                                <template #prepend>
                                                    <v-icon>mdi-calendar-range</v-icon>
                                                </template>
                                                <v-list-item-title>{{ t('days') }}</v-list-item-title>
                                                <v-list-item-subtitle class="pb-2">
                                                    <v-chip
                                                        v-for="(day, index) in item.solarDays" :key="index"
                                                        :color="getChipColor(day)" density="compact"
                                                    >
                                                        <span>{{ mapDayOfWeek(day).slice(0, 3) }}</span>
                                                    </v-chip>
                                                </v-list-item-subtitle>
                                            </v-list-item>

                                            <v-list-item v-if="item.time" class="prepend-icon-spacing">
                                                <template #prepend>
                                                    <v-icon
                                                        :icon="item.timespan === 'time' ? 'mdi-clock-start' : 'mdi-clock'"
                                                        :color="item.timespan === 'time' ? 'green' : undefined"
                                                    />
                                                </template>
                                                <v-list-item-title>
                                                    {{ item.timespan === 'time' ? t('startTime') : t('time') }}
                                                </v-list-item-title>
                                                <v-list-item-subtitle>{{ formatTime(item.time) }}</v-list-item-subtitle>
                                            </v-list-item>

                                            <v-list-item
                                                v-if="item.timespan === 'time' && item.endTime"
                                                class="prepend-icon-spacing"
                                            >
                                                <template #prepend>
                                                    <v-icon color="red">mdi-clock-end</v-icon>
                                                </template>
                                                <v-list-item-title>
                                                    {{ t('endTime')
                                                    }}
                                                </v-list-item-title>
                                                <v-list-item-subtitle>
                                                    {{ formatTime(item.endTime)
                                                    }}
                                                </v-list-item-subtitle>
                                            </v-list-item>

                                            <v-list-item
                                                v-if="item.solarEventTimespanTime"
                                                class="prepend-icon-spacing"
                                            >
                                                <template #prepend>
                                                    <v-icon
                                                        :icon="!item.solarEventStart ? 'mdi-clock-start' : 'mdi-clock-end'"
                                                        :color="!item.solarEventStart ? 'green' : 'red'"
                                                    />
                                                </template>
                                                <v-list-item-title>
                                                    {{ !item.solarEventStart ? t('startTime') : t('endTime') }}
                                                </v-list-item-title>
                                                <v-list-item-subtitle>
                                                    {{ formatTime(item.solarEventTimespanTime)
                                                    }}
                                                </v-list-item-subtitle>
                                            </v-list-item>

                                            <v-list-item v-if="item.minutesInterval" class="prepend-icon-spacing">
                                                <template #prepend>
                                                    <v-icon>mdi-repeat</v-icon>
                                                </template>
                                                <v-list-item-title>{{ t('intervalMinutes') }}</v-list-item-title>
                                                <v-list-item-subtitle>{{ item.minutesInterval }}</v-list-item-subtitle>
                                            </v-list-item>

                                            <v-list-item v-if="item.hourlyInterval" class="prepend-icon-spacing">
                                                <template #prepend>
                                                    <v-icon>mdi-repeat</v-icon>
                                                </template>
                                                <v-list-item-title>{{ t('intervalHours') }}</v-list-item-title>
                                                <v-list-item-subtitle>{{ item.hourlyInterval }}</v-list-item-subtitle>
                                            </v-list-item>

                                            <v-list-item
                                                v-if="item.calculatedDurationPretty"
                                                class="prepend-icon-spacing"
                                            >
                                                <template #prepend>
                                                    <v-icon>mdi-timer-sand</v-icon>
                                                </template>
                                                <v-list-item-title>{{ t('duration') }}</v-list-item-title>
                                                <v-list-item-subtitle>
                                                    {{ item.calculatedDurationPretty
                                                    }}
                                                </v-list-item-subtitle>
                                            </v-list-item>

                                            <v-divider
                                                v-if="(item.scheduleType === 'solar' && item.timespan !== false) || item.solarDays"
                                            />
                                            <v-list-subheader v-if="item.solarEvent">{{ t('solar') }}</v-list-subheader>

                                            <v-list-item v-if="item.solarEvent" class="prepend-icon-spacing">
                                                <template #prepend>
                                                    <v-icon>mdi-weather-sunset</v-icon>
                                                </template>
                                                <v-list-item-title>{{ t('solarEvent') }}</v-list-item-title>
                                                <v-list-item-subtitle>
                                                    {{ mapSolarEvent(item.solarEvent)
                                                    }}
                                                </v-list-item-subtitle>
                                            </v-list-item>

                                            <v-list-item v-if="item.offset" class="prepend-icon-spacing">
                                                <template #prepend>
                                                    <v-icon>mdi-plus-minus</v-icon>
                                                </template>
                                                <v-list-item-title>{{ t('offset') }}</v-list-item-title>
                                                <v-list-item-subtitle>{{ item.offset }}</v-list-item-subtitle>
                                            </v-list-item>

                                            <v-list-subheader v-if="item.scheduleType === 'cron'">
                                                {{ t('cron')
                                                }}
                                            </v-list-subheader>
                                            <v-list-item
                                                v-if="item.scheduleType === 'cron'" lines="two"
                                                class="prepend-icon-spacing"
                                            >
                                                <template #prepend>
                                                    <v-icon>mdi-code-brackets</v-icon>
                                                </template>
                                                <v-list-item-title>{{ t('cronExpression') }}</v-list-item-title>
                                                <v-list-item-subtitle>
                                                    {{ item.startCronExpression
                                                    }}
                                                </v-list-item-subtitle>
                                            </v-list-item>

                                            <v-divider />
                                            <v-list-subheader>{{ t('next') }}</v-list-subheader>

                                            <v-list-item
                                                v-if="item.primaryTask?.nextDescription" lines="two"
                                                class="prepend-icon-spacing" @click="requestStatus(item)"
                                            >
                                                <template #prepend>
                                                    <v-icon :color="item.timespan ? 'green' : ''">
                                                        mdi-calendar-text
                                                    </v-icon>
                                                </template>
                                                <v-list-item-title>{{ t('nextDescription') }}</v-list-item-title>
                                                <v-list-item-subtitle>
                                                    {{ item.primaryTask?.nextDescription
                                                    }}
                                                </v-list-item-subtitle>
                                            </v-list-item>

                                            <v-list-group>
                                                <template #activator="{ isOpen, props }">
                                                    <v-list-item
                                                        v-bind="props"
                                                        class="prepend-icon-spacing no-padding-start" lines="two"
                                                        @click="handleNextDatesExpand(isOpen)"
                                                    >
                                                        <template #prepend>
                                                            <v-icon :color="item.timespan ? 'green' : undefined">
                                                                mdi-calendar-arrow-right
                                                            </v-icon>
                                                        </template>
                                                        <v-list-item-title>{{ t('nextDate') }}</v-list-item-title>
                                                        <v-list-item-subtitle>
                                                            {{ item.primaryTask?.nextLocal
                                                            }}
                                                        </v-list-item-subtitle>
                                                    </v-list-item>
                                                </template>
                                                <v-list-item
                                                    v-for="(date, index) in item.primaryTask?.nextDates"
                                                    :key="index" class="no-padding-start" lines="two"
                                                >
                                                    <v-list-item-subtitle>
                                                        <strong>{{ index + 1 }}.&nbsp;&nbsp;</strong>{{ date }}
                                                    </v-list-item-subtitle>
                                                </v-list-item>
                                            </v-list-group>

                                            <v-list-item
                                                v-if="item.endTask?.nextLocal" lines="two"
                                                class="prepend-icon-spacing"
                                            >
                                                <template #prepend>
                                                    <v-icon color="red">mdi-calendar-arrow-right</v-icon>
                                                </template>
                                                <v-list-item-title>{{ t('nextEndDate') }}</v-list-item-title>
                                                <v-list-item-subtitle>
                                                    {{ item.endTask?.nextLocal
                                                    }}
                                                </v-list-item-subtitle>
                                            </v-list-item>
                                        </v-list>
                                    </v-row>
                                </v-card-text>
                            </v-card>
                        </td>
                    </tr>
                </v-slide-x-transition>
            </template>

            <template #no-data>
                <div class="text-center my-4">{{ t('noSchedules') }}</div>
            </template>
        </v-data-table>

        <v-dialog v-model="dialog" :fullscreen="$vuetify.display.xs" rounded="lg" color="background" max-width="500px">
            <v-row v-if="validationResult.alert">
                <v-alert
                    v-model="validationResult.alert" :title="t('error')" min-height="fit-content" type="error"
                    closable
                >
                    {{ validationResult.message }}
                </v-alert>
            </v-row>
            <v-card :class="{ 'bordered-card': !$vuetify.display.xs, 'border-none': $vuetify.display.xs }" class="pa-2">
                <v-card-title class="d-flex align-items-center justify-space-between pb-0 scheduler-button">
                    <span class="text-h5">{{ isEditing ? t('editSchedule') : t('newSchedule') }}</span>
                    <div class="d-flex align-items-center">
                        <v-switch
                            v-model="enabled" :disabled="invalid" :label=" !$vuetify.display.xs ? (enabled ? t('enabled') : t('disabled')) : ''"
                            :color="enabled ? 'green' : 'default'" required class="mr-2"
                        />
                        <v-btn
                            v-if="isEditing" id="nrdb2-ui-scheduler-export-schedule-button" icon variant="plain"
                            color="blue" @click="openExportDialog()"
                        >
                            <v-icon>mdi-export</v-icon>
                        </v-btn>
                        <v-btn
                            v-if="!isEditing" id="nrdb2-ui-scheduler-import-schedule-button" icon variant="plain"
                            color="green" @click="openImportDialog()"
                        >
                            <v-icon>mdi-import</v-icon>
                        </v-btn>
                        <v-btn
                            v-if="isEditing" id="nrdb2-ui-scheduler-delete-schedule-button" icon
                            color="red-lighten-1" @click="openDeleteDialog()"
                        >
                            <v-icon>mdi-delete</v-icon>
                        </v-btn>
                    </div>
                </v-card-title>
                <v-card-text class="pt-0">
                    <v-row justify="center">
                        <v-col cols="12" class="pt-0">
                            <v-text-field
                                v-if="!isEditing" id="nrdb2-ui-scheduler-schedule-name-input" v-model="name"
                                :label="t('scheduleName')" :rules="[rules.required]" required :disabled="isEditing"
                            >
                                <template #append-inner>
                                    <v-icon v-if="!isNameDuplicate()" color="green" icon="mdi-check-circle" />
                                    <v-icon v-else color="red" icon="mdi-close-circle" />
                                </template>
                            </v-text-field>
                            <h2 v-else class="text-center pb-4">
                                {{ name }}
                            </h2>
                        </v-col>
                    </v-row>

                    <v-row v-if="props.uiOptionTopic" no-gutters justify="center">
                        <v-col cols="12" class="d-flex justify-center">
                            <v-label>{{ t('topic') }}</v-label>
                        </v-col>
                        <v-col cols="12">
                            <v-select
                                v-model="topic" :items="props.topics" :label="t('selectTopic')" required
                                :rules="[rules.required]"
                            >
                                <template #prepend-inner>
                                    <v-icon>mdi-sitemap-outline</v-icon>
                                </template>
                            </v-select>
                        </v-col>
                    </v-row>

                    <v-row
                        v-if="[props.uiOptionTime, props.uiOptionSolar, props.uiOptionCron].filter(Boolean).length > 1"
                        no-gutters class="d-flex justify-center"
                    >
                        <v-col cols="12" class="d-flex justify-center">
                            <v-label>{{ t('type') }}</v-label>
                        </v-col>
                        <v-col cols="12" class="d-flex justify-center">
                            <v-btn-toggle
                                v-model="scheduleType"
                                class="scheduler-button" :label="t('scheduleType')" mandatory divided
                                variant="elevated" border="sm" rounded="xl"
                            >
                                <v-btn v-if="props.uiOptionTime" prepend-icon="mdi-clock-outline" value="time">
                                    {{
                                        t('time')
                                    }}
                                </v-btn>
                                <v-btn v-if="props.uiOptionSolar" prepend-icon="mdi-sun-clock" value="solar">
                                    {{
                                        t('solar')
                                    }}
                                </v-btn>
                                <v-btn
                                    v-if="props.uiOptionCron" prepend-icon="mdi-code-brackets"
                                    group:selected="cronType()" value="cron"
                                >
                                    {{ t('cron') }}
                                </v-btn>
                            </v-btn-toggle>
                        </v-col>
                    </v-row>

                    <v-row v-if="scheduleType === 'time'" justify="center" class="mb-5">
                        <v-row
                            v-if="[props.uiOptionMinute, props.uiOptionHour, props.uiOptionDay, props.uiOptionWeek, props.uiOptionMonth, props.uiOptionYear].filter(Boolean).length > 1"
                            no-gutters
                        >
                            <v-col cols="12" class="d-flex justify-center">
                                <v-label>{{ t('period') }}</v-label>
                            </v-col>
                            <v-col cols="12" class="mx-auto">
                                <v-btn-toggle
                                    v-model="period"
                                    class="scheduler-button d-flex flex-wrap" style="min-height: fit-content"
                                    :label="t('period')" mandatory border="sm" rounded="xl"
                                >
                                    <v-row
                                        v-if="props.uiOptionMinute || props.uiOptionHour || props.uiOptionDay"
                                        no-gutters
                                    >
                                        <v-col v-if="props.uiOptionMinute">
                                            <v-btn
                                                prepend-icon="mdi-timer-refresh-outline" value="minutes"
                                                min-width="100%"
                                            >
                                                {{ t('minute') }}
                                            </v-btn>
                                        </v-col>
                                        <v-col v-if="props.uiOptionHour">
                                            <v-btn prepend-icon="mdi-timer-refresh" value="hourly" min-width="100%">
                                                {{ t('hour') }}
                                            </v-btn>
                                        </v-col>
                                        <v-col v-if="props.uiOptionDay">
                                            <v-btn prepend-icon="mdi-calendar-range" value="daily" min-width="100%">
                                                {{ t('day') }}
                                            </v-btn>
                                        </v-col>
                                    </v-row>
                                    <v-row
                                        v-if="props.uiOptionWeek || props.uiOptionMonth || props.uiOptionYear"
                                        no-gutters
                                    >
                                        <v-col v-if="props.uiOptionWeek">
                                            <v-btn prepend-icon="mdi-calendar-weekend" value="weekly" min-width="100%">
                                                {{ t('week') }}
                                            </v-btn>
                                        </v-col>
                                        <v-col v-if="props.uiOptionMonth">
                                            <v-btn
                                                prepend-icon="mdi-calendar-month-outline" value="monthly"
                                                min-width="100%"
                                            >
                                                {{ t('month') }}
                                            </v-btn>
                                        </v-col>
                                        <v-col v-if="props.uiOptionYear">
                                            <v-btn
                                                prepend-icon="mdi-calendar-today-outline" value="yearly"
                                                min-width="100%"
                                            >
                                                {{ t('year') }}
                                            </v-btn>
                                        </v-col>
                                    </v-row>
                                </v-btn-toggle>
                            </v-col>
                        </v-row>

                        <v-row justify="center">
                            <v-col v-if="period === 'daily'" cols="12" class="d-flex justify-center">
                                <v-select
                                    v-model="dailyDays" :items="daysOfWeek" :label="t('selectDays')" multiple
                                    required chips :rules="[rules.required]"
                                >
                                    <template #prepend-inner>
                                        <v-icon>mdi-calendar-range</v-icon>
                                    </template>
                                    <template #chip="{ item }">
                                        <v-chip :color="getChipColor(item.value)" density="comfortable">
                                            <span>{{ item.title }}</span>
                                        </v-chip>
                                    </template>
                                </v-select>
                            </v-col>

                            <v-col v-if="period === 'weekly'" cols="12" class="d-flex justify-center">
                                <v-select
                                    v-model="weeklyDays" :items="daysOfWeek" :label="t('selectDays')" multiple
                                    required chips :rules="[rules.required]"
                                >
                                    <template #prepend-inner>
                                        <v-icon>mdi-calendar-weekend</v-icon>
                                    </template>
                                    <template #chip="{ item }">
                                        <v-chip :color="getChipColor(item.value)" density="comfortable">
                                            <span>{{ item.title }}</span>
                                        </v-chip>
                                    </template>
                                </v-select>
                            </v-col>

                            <v-col v-if="period === 'monthly'" cols="12" class="d-flex justify-center">
                                <v-select
                                    v-model="monthlyDays" :items="localizedDaysOfMonth" :label="t('selectDays')"
                                    multiple chips required :rules="[rules.required]"
                                >
                                    <template #prepend-inner>
                                        <v-icon>mdi-calendar-month-outline</v-icon>
                                    </template>
                                    <template #chip="{ item }">
                                        <v-chip :color="getChipColor(item.value)" density="comfortable">
                                            <span>{{ item.title }}</span>
                                        </v-chip>
                                    </template>
                                </v-select>
                            </v-col>

                            <v-col v-if="period === 'yearly'" cols="12" class="d-flex justify-center">
                                <v-select
                                    v-model="yearlyMonth" :items="months" :label="t('selectMonth')" required
                                    :rules="[rules.required]"
                                >
                                    <template #prepend-inner>
                                        <v-icon>mdi-calendar-month-outline</v-icon>
                                    </template>
                                </v-select>
                            </v-col>

                            <v-col v-if="period === 'yearly'" cols="12" class="d-flex justify-center">
                                <v-select
                                    v-model="yearlyDay" :items="localizedDaysOfMonth" :label="t('selectDay')"
                                    required :rules="[rules.required]"
                                >
                                    <template #prepend-inner>
                                        <v-icon>mdi-calendar-today-outline</v-icon>
                                    </template>
                                    <template #chip="{ item }">
                                        <v-chip color="blue" density="comfortable">
                                            <span>{{ item.title }}</span>
                                        </v-chip>
                                    </template>
                                </v-select>
                            </v-col>

                            <v-col v-if="period === 'minutes'" cols="12" class="d-flex justify-center">
                                <v-select
                                    v-model="minutesInterval" :items="generateNumberArray(1, 59)"
                                    :label="t('intervalMinutes')" :rules="[rules.required]"
                                >
                                    <template #prepend-inner>
                                        <v-icon>mdi-repeat</v-icon>
                                    </template>
                                </v-select>
                            </v-col>

                            <v-col v-if="period === 'hourly'" cols="12" class="d-flex justify-center">
                                <v-select
                                    v-model="hourlyInterval" :items="generateNumberArray(1, 23)"
                                    :label="t('intervalHours')" :rules="[rules.required]"
                                >
                                    <template #prepend-inner>
                                        <v-icon>mdi-repeat</v-icon>
                                    </template>
                                </v-select>
                            </v-col>

                            <v-col
                                v-if="period !== 'minutes' && period !== 'hourly'" cols="12"
                                class="d-flex justify-center"
                            >
                                <v-text-field
                                    v-if="props.uiOptionNewTimePicker" v-model="formattedTime"
                                    :active="modalTime" :focused="modalTime" readonly :rules="[rules.required]"
                                    :label="timespan === 'time' ? t('startTime') : t('time')"
                                >
                                    <template #prepend-inner>
                                        <v-icon
                                            :color="timespan === 'time' ? 'green' : undefined"
                                            :icon="timespan === 'time' ? 'mdi-clock-start' : 'mdi-clock-time-four-outline'"
                                        />
                                    </template>
                                    <v-dialog v-model="modalTime" activator="parent" width="auto">
                                        <v-time-picker
                                            v-if="modalTime" v-model="time"
                                            :format="props.use24HourFormat ? '24hr' : 'ampm'"
                                            :ampm-in-title="!props.use24HourFormat"
                                        />
                                    </v-dialog>
                                </v-text-field>
                                <v-text-field
                                    v-else v-model="time"
                                    :label="timespan === 'time' ? t('startTime') : t('time')" type="time"
                                    :rules="[rules.required]"
                                >
                                    <template #prepend-inner>
                                        <v-icon
                                            :color="timespan === 'time' ? 'green' : undefined"
                                            :icon="timespan === 'time' ? 'mdi-clock-start' : 'mdi-clock-time-four-outline'"
                                        />
                                    </template>
                                </v-text-field>
                            </v-col>

                            <v-col
                                v-if="timespan === 'time' && period !== 'minutes' && period !== 'hourly'" cols="12"
                                class="d-flex justify-center"
                            >
                                <v-text-field
                                    v-if="props.uiOptionNewTimePicker" v-model="formattedEndTime"
                                    :active="modalEndTime" :focused="modalEndTime" :label="t('endTime')" readonly
                                    :rules="[rules.endTimeRule]"
                                >
                                    <template #prepend-inner>
                                        <v-icon color="red" icon="mdi-clock-end" />
                                    </template>
                                    <v-dialog v-model="modalEndTime" activator="parent" width="auto">
                                        <v-time-picker
                                            v-if="modalEndTime" v-model="endTime" :min="time"
                                            :format="props.use24HourFormat ? '24hr' : 'ampm'"
                                            :ampm-in-title="!props.use24HourFormat"
                                        />
                                    </v-dialog>
                                </v-text-field>
                                <v-text-field
                                    v-else v-model="endTime" :label="t('endTime')" type="time"
                                    :rules="[rules.required]"
                                >
                                    <template #prepend-inner>
                                        <v-icon color="red" icon="mdi-clock-end" />
                                    </template>
                                </v-text-field>
                            </v-col>
                        </v-row>

                        <v-row
                            v-if="period !== 'minutes' && period !== 'hourly' && props.uiOptionTimespan"
                            justify="center" no-gutters
                        >
                            <v-col cols="12" class="d-flex justify-center">
                                <v-label>{{ t('timespan') }}</v-label>
                            </v-col>
                            <v-col cols="12" class="d-flex justify-center">
                                <v-btn-toggle
                                    v-model="timespan"
                                    class="scheduler-button" mandatory divided variant="elevated" border="sm"
                                    rounded="xl" @update:model-value="setEndTime"
                                >
                                    <v-btn prepend-icon="mdi-circle-off-outline" :value="false">
                                        {{ t('none') }}
                                    </v-btn>
                                    <v-btn prepend-icon="mdi-clock-end" value="time">
                                        {{ t('endTime') }}
                                    </v-btn>
                                </v-btn-toggle>
                            </v-col>
                        </v-row>
                    </v-row>

                    <v-row v-if="scheduleType === 'solar'" no-gutters class="mt-6">
                        <v-col cols="12" class="d-flex justify-center">
                            <v-label>{{ t('event') }}</v-label>
                        </v-col>
                        <v-col cols="12" class="d-flex justify-center">
                            <v-select
                                v-model="solarEvent" :items="solarEvents" :label="t('selectEvent')" required
                                :rules="[rules.required]"
                            >
                                <template #prepend-inner>
                                    <v-icon>mdi-weather-sunset</v-icon>
                                </template>
                            </v-select>
                        </v-col>
                        <v-col cols="12" class="d-flex justify-center">
                            <v-select
                                v-model="offset" :items="offsetItems" :label="t('offsetMinutes')"
                                :rules="[rules.requiredNumber]"
                            >
                                <template #prepend-inner>
                                    <v-icon>mdi-plus-minus</v-icon>
                                </template>
                            </v-select>
                        </v-col>
                        <v-col cols="12" class="d-flex justify-center">
                            <v-expansion-panels v-model="solarShowMore" class="my-4" variant="popout">
                                <v-expansion-panel :title="t('moreOptions')" value="moreOptions">
                                    <v-expansion-panel-text>
                                        <v-select
                                            v-model="solarDays" :items="daysOfWeek" :label="t('selectDays')"
                                            multiple required chips :rules="[rules.required]"
                                        >
                                            <template #prepend-inner>
                                                <v-icon>mdi-calendar-range</v-icon>
                                            </template>
                                            <template #chip="{ item }">
                                                <v-chip :color="getChipColor(item.value)" density="comfortable">
                                                    <span>{{ item.title }}</span>
                                                </v-chip>
                                            </template>
                                        </v-select>
                                    </v-expansion-panel-text>
                                </v-expansion-panel>
                            </v-expansion-panels>
                        </v-col>
                    </v-row>

                    <v-row v-if="scheduleType === 'cron'" justify="center" no-gutters class="my-6">
                        <v-col cols="12" class="d-flex justify-center">
                            <v-label>{{ t('description') }}</v-label>
                        </v-col>
                        <v-col cols="12" class="d-flex justify-center">
                            <v-textarea
                                v-if="!cronLoading" v-model="cronDescription" readonly rows="2" auto-grow
                                variant="solo" class="centered-input"
                            />
                            <v-progress-linear v-else indeterminate />
                        </v-col>
                        <v-col cols="12" class="d-flex justify-center">
                            <v-expansion-panels class="my-4" variant="popout">
                                <v-expansion-panel v-if="cronNextDates" :title="t('nextInfo')">
                                    <v-expansion-panel-text>
                                        <v-list>
                                            <v-list-subheader class="centered-subheader">
                                                {{ t('nextDates')
                                                }}
                                            </v-list-subheader>
                                            <v-list-item
                                                v-for="(date, index) in cronNextDates" :key="index"
                                                class="px-auto"
                                            >
                                                {{ date }}
                                            </v-list-item>
                                            <v-list-subheader class="centered-subheader">
                                                {{ t('nextTime')
                                                }}
                                            </v-list-subheader>
                                            <v-list-item class="px-auto">{{ cronNextTime }}</v-list-item>
                                        </v-list>
                                    </v-expansion-panel-text>
                                </v-expansion-panel>
                                <v-expansion-panel :title="t('cronInfo')">
                                    <v-expansion-panel-text>
                                        <CronFieldsTable class="mb-4" />
                                        <v-divider />
                                        <CronSpecialCharacters />
                                    </v-expansion-panel-text>
                                </v-expansion-panel>
                            </v-expansion-panels>
                        </v-col>
                        <v-col cols="12" class="d-flex justify-center mt-3">
                            <v-label>{{ t('expression') }}</v-label>
                        </v-col>
                        <v-col cols="11" class="d-flex justify-center">
                            <v-text-field
                                :model-value="cronValue" style="letter-spacing: 2px;"
                                @update:model-value="updateCronValue"
                            >
                                <template #prepend-inner>
                                    <v-icon>mdi-code-brackets</v-icon>
                                </template>
                            </v-text-field>
                            <v-col cols="1" class="d-flex justify-center">
                                <v-progress-circular v-if="cronLoading" indeterminate size="24" />
                                <v-icon v-if="!cronLoading && cronExpValid" color="green" icon="mdi-check-circle" />
                                <v-icon v-if="!cronLoading && !cronExpValid" color="red" icon="mdi-close-circle" />
                            </v-col>
                        </v-col>
                        <v-col cols="12" class="d-flex justify-center">
                            <CronVuetify
                                v-model="cronValue" :fields="fields" :locale="locale" :chipProps="{ color: 'primary' }"
                                format="quartz"
                            />
                        </v-col>
                    </v-row>

                    <v-row
                        v-if="((period === 'minutes' || period === 'hourly') || scheduleType === 'solar' || scheduleType === 'cron') && props.uiOptionTimespan"
                        justify="center" no-gutters
                    >
                        <v-col cols="12" class="d-flex justify-center">
                            <v-label>{{ t('timespan') }}</v-label>
                        </v-col>
                        <v-col cols="12" class="d-flex justify-center mb-5">
                            <v-btn-toggle
                                v-model="timespan"
                                class="scheduler-button" mandatory divided variant="elevated" border="sm"
                                rounded="xl"
                            >
                                <v-btn prepend-icon="mdi-circle-off-outline" :value="false">{{ t('none') }}</v-btn>
                                <v-btn prepend-icon="mdi-timer-sand-complete" value="duration">
                                    {{ t('duration')
                                    }}
                                </v-btn>
                                <v-btn
                                    v-if="(scheduleType === 'solar')" prepend-icon="mdi-clock-time-four-outline"
                                    :value="'time'"
                                >
                                    {{ t('time') }}
                                </v-btn>
                                <v-btn
                                    v-if="(scheduleType === 'solar')" prepend-icon="mdi-weather-sunset"
                                    :value="'solar'"
                                >
                                    {{ t('solar') }}
                                </v-btn>
                            </v-btn-toggle>
                        </v-col>
                        <v-col v-if="timespan === 'time'" cols="12" class="d-flex justify-center">
                            <v-radio-group v-model="solarEventStart" inline class="d-flex justify-center">
                                <v-radio :label="t('start')" color="green" :value="false" class="mx-6" />
                                <v-radio :label="t('end')" color="red" :value="true" class="mx-6" />
                            </v-radio-group>
                        </v-col>
                        <v-col
                            v-if="((period === 'minutes' || period === 'hourly') || (scheduleType === 'solar' && timespan !== 'solar') || scheduleType === 'cron')"
                            cols="12" class="d-flex justify-center"
                        >
                            <v-select
                                v-if="timespan === 'duration'" v-model="duration" :items="durationItems"
                                :label="t('duration') + ' (' + t('minutes') + ')'" :rules="[rules.required]"
                            >
                                <template #prepend-inner>
                                    <v-icon>mdi-timer-sand-complete</v-icon>
                                </template>
                            </v-select>
                            <v-col v-if="timespan === 'time'" class="d-flex justify-center">
                                <v-text-field
                                    v-if="props.uiOptionNewTimePicker"
                                    v-model="formattedSolarEventTimespanTime" :active="modalTime" :focused="modalTime"
                                    readonly :rules="[rules.required]" :label="t('time')"
                                >
                                    <template #prepend-inner>
                                        <v-icon
                                            :color="solarEventStart ? 'red' : 'green'"
                                            :icon="solarEventStart ? 'mdi-clock-end' : 'mdi-clock-start'"
                                        />
                                    </template>
                                    <v-dialog v-model="modalTime" activator="parent" width="auto">
                                        <v-time-picker
                                            v-if="modalTime" v-model="solarEventTimespanTime"
                                            :format="props.use24HourFormat ? '24hr' : 'ampm'"
                                            :ampm-in-title="!props.use24HourFormat"
                                        />
                                    </v-dialog>
                                </v-text-field>
                                <v-text-field
                                    v-else v-model="solarEventTimespanTime" :label="t('time')" type="time"
                                    :rules="[rules.required]"
                                >
                                    <template #prepend-inner>
                                        <v-icon
                                            :color="solarEventStart ? 'red' : 'green'"
                                            :icon="solarEventStart ? 'mdi-clock-end' : 'mdi-clock-start'"
                                        />
                                    </template>
                                </v-text-field>
                            </v-col>
                        </v-col>
                        <v-col v-if="timespan === 'solar'" cols="12" class="d-flex justify-center mt-2">
                            <v-label>{{ t('endEvent') }}</v-label>
                        </v-col>
                        <v-col v-if="timespan === 'solar'" cols="12" class="d-flex justify-center">
                            <v-select
                                v-model="solarEventEnd" :items="solarEvents" :label="t('selectEvent')" required
                                :rules="[rules.required]"
                            >
                                <template #prepend-inner>
                                    <v-icon>mdi-weather-sunset-down</v-icon>
                                </template>
                            </v-select>
                        </v-col>
                        <v-col v-if="timespan === 'solar'" cols="12" class="d-flex justify-center">
                            <v-select
                                v-model="offsetEnd" :items="offsetItems" :label="t('offsetMinutes')"
                                :rules="[rules.requiredNumber]"
                            >
                                <template #prepend-inner>
                                    <v-icon>mdi-plus-minus</v-icon>
                                </template>
                            </v-select>
                        </v-col>
                    </v-row>

                    <v-row justify="center" no-gutters>
                        <v-col cols="12" class="d-flex justify-center">
                            <v-label>{{ t('output') }}</v-label>
                        </v-col>
                        <v-col cols="12" class="d-flex justify-center">
                            <v-btn-toggle
                                v-model="payloadType"
                                class="scheduler-button" mandatory divided variant="elevated" border="sm"
                                rounded="xl"
                            >
                                <v-btn
                                    v-if="!isTimespanSchedule" prepend-icon="mdi-close-circle-outline" :value="false"
                                    color="red"
                                >
                                    {{ t('false') }}
                                </v-btn>
                                <v-btn
                                    v-if="!isTimespanSchedule" prepend-icon="mdi-check-circle-outline" :value="true"
                                    color="green"
                                >
                                    {{ t('true') }}
                                </v-btn>
                                <v-btn
                                    v-if="isTimespanSchedule" prepend-icon="mdi-check-circle-outline"
                                    :value="'true_false'" color="green"
                                >
                                    {{ t('trueFalse') }}
                                </v-btn>
                                <v-btn
                                    v-if="props.uiOptionCustomOutput" prepend-icon="mdi-code-braces"
                                    :value="'custom'" color="blue"
                                >
                                    {{ t('custom') }}
                                </v-btn>
                            </v-btn-toggle>
                        </v-col>
                        <v-col v-if="payloadType === 'custom'" cols="12" class="d-flex justify-center mt-3">
                            <v-select
                                v-model="customPayloadStart" :items="customPayloads"
                                :item-title="getCustomPayloadTitle" item-value="id"
                                :label="isTimespanSchedule ? (timespan !== 'time' ? t('customOutputStart') : (solarEventStart && scheduleType === 'solar' ? t('customOutputSolarEvent') : t('customOutputStart'))) : t('customOutput')"
                                no-data-text="No custom payloads defined" :rules="rules.required"
                            >
                                <template #prepend-inner>
                                    <v-icon
                                        v-if="isTimespanSchedule && scheduleType === 'solar' && timespan === 'time'"
                                        color="green" :icon="solarEventStart ? 'mdi-weather-sunset' : 'mdi-clock'"
                                    />
                                    <v-icon
                                        :color="isTimespanSchedule ? 'green' : undefined"
                                        :icon="isTimespanSchedule ? 'mdi-arrow-expand-right' : 'mdi-arrow-right-thin'"
                                    />
                                </template>
                            </v-select>
                        </v-col>
                        <v-col
                            v-if="payloadType === 'custom' && isTimespanSchedule" cols="12"
                            class="d-flex justify-center"
                        >
                            <v-select
                                v-model="customPayloadEnd" :items="customPayloads"
                                :item-title="getCustomPayloadTitle" item-value="id"
                                :label="isTimespanSchedule && timespan !== 'time' ? t('customOutputEnd') : (!solarEventStart && scheduleType === 'solar' ? t('customOutputSolarEvent') : t('customOutputEnd'))"
                                no-data-text="No custom payloads defined" :rules="rules.required"
                            >
                                <template #prepend-inner>
                                    <v-icon
                                        v-if="isTimespanSchedule && scheduleType === 'solar' && timespan === 'time'"
                                        color="red" :icon="!solarEventStart ? 'mdi-weather-sunset' : 'mdi-clock'"
                                    />
                                    <v-icon color="red" icon="mdi-arrow-collapse-right" />
                                </template>
                            </v-select>
                        </v-col>
                    </v-row>
                </v-card-text>
                <v-card-actions class="d-flex justify-center mb-5">
                    <v-btn variant="outlined" color="green" @click="saveSchedule">
                        {{ t('save') }}
                    </v-btn>
                    <v-btn variant="outlined" color="red" @click="closeDialog">
                        {{ t('cancel') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog
            v-model="dialogDelete" min-width="fit-content" scrim="red-darken-4" color="background"
            max-width="500px"
        >
            <v-card>
                <v-card-title class="text-body-2 text-center">
                    {{ t('deleteScheduleConfirmation') }}
                </v-card-title>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="outlined" color="error" @click="deleteConfirm">
                        {{ t('delete') }}
                    </v-btn>
                    <v-btn variant="outlined" @click="closeDelete">
                        {{ t('cancel') }}
                    </v-btn>
                    <v-spacer />
                </v-card-actions>
            </v-card>
        </v-dialog>
        <!-- Export Dialog -->
        <v-dialog v-model="showExportDialog" max-width="500">
            <v-card>
                <!-- Notification Alert: Displays copy status (or error messages) -->
                <v-row v-if="copiedAlert">
                    <v-alert v-model="copiedAlert" min-height="fit-content" type="success" color="green" closable>
                        {{ t('copiedToClipboard') }}
                    </v-alert>
                </v-row>
                <v-card-title class="text-h5"> {{ t('exportSchedule') }}</v-card-title>
                <v-card-text>
                    <div v-if="exportLoading" class="text-center">
                        <v-progress-circular indeterminate color="blue" size="40" />
                        <div style="margin-top: 10px;"> {{ t('loadingScheduleExport') }}</div>
                    </div>
                    <div v-else-if="exportError">
                        <v-alert type="error" density="compact" variant="outlined">{{ exportError }}</v-alert>
                    </div>
                    <div v-else>
                        <v-textarea
                            v-model="exportedScheduleJSON" :label="t('exportedSchedule')" rows="10" auto-grow
                            readonly
                        />
                    </div>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="outlined" @click="closeExportDialog">
                        {{ t('close') }}
                    </v-btn>
                    <v-btn variant="outlined" color="primary" :disabled="!exportedScheduleJSON" @click="copyExport">
                        {{ t('copy') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Import Dialog -->
        <v-dialog v-model="showImportDialog" max-width="500">
            <v-card>
                <v-card-title class="text-h5"> {{ t('importSchedule') }}</v-card-title>
                <v-card-text>
                    <v-textarea
                        id="nrdb2-ui-scheduler-import-schedule-textarea" v-model="importText"
                        :label="t('pasteJSONSchedule')" rows="10" auto-grow
                    />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="outlined" @click="closeImportDialog">{{ t('cancel') }}</v-btn>
                    <v-btn variant="outlined" color="primary" :disabled="!isValidJson" @click="handleImport">
                        {{ t('import') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-container>
</template>

<script setup>
// eslint-disable-next-line no-unused-vars
import { defaultItems, pad } from '@vue-js-cron/core'
// eslint-disable-next-line no-unused-vars
import { useDisplay } from 'vuetify'
</script>
<script>
import { mapState } from 'vuex'

// Import translations
import de from '../locales/de.json'
import en from '../locales/en.json'
import es from '../locales/es.json'
import fr from '../locales/fr.json'
import it from '../locales/it.json'
import nl from '../locales/nl.json'

import CronFieldsTable from './CronFieldsTable.vue'
import CronSpecialCharacters from './CronSpecialCharacters.vue'
import CronVuetify from './cron-vuetify.vue'

function hsvToRgb (h, s, v) {
    let r, g, b
    const i = Math.floor(h * 6)
    const f = h * 6 - i
    const p = v * (1 - s)
    const q = v * (1 - f * s)
    const t = v * (1 - (1 - f) * s)
    switch (i % 6) {
    case 0:
        r = v
        g = t
        b = p
        break
    case 1:
        r = q
        g = v
        b = p
        break
    case 2:
        r = p
        g = v
        b = t
        break
    case 3:
        r = p
        g = q
        b = v
        break
    case 4:
        r = t
        g = p
        b = v
        break
    case 5:
        r = v
        g = p
        b = q
        break
    }

    return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`
}

export default {
    name: 'UIScheduler',
    components: {
        CronVuetify,
        CronFieldsTable,
        CronSpecialCharacters
    },
    inject: ['$socket', '$dataTracker'],
    props: {
        id: {
            type: String,
            required: true
        },
        props: {
            type: Object,
            default: () => ({})
        },
        state: {
            type: Object,
            default: () => ({})
        },
        init: {
            type: String,
            default: '* * * * *'
        }
    },
    // setup () {
    //     const { mobile } = useDisplay()

    //     return {
    //         isMobile: mobile
    //     }
    // },
    data: () => {
        return {
            // General state
            currentSchedule: null,
            isEditing: false,
            selectedTopic: 'All',
            now: new Date().getTime(),
            validationResult: {
                alert: false,
                message: ''
            },
            copiedAlert: false,

            // Scheduling options
            scheduleId: null,
            name: null,
            enabled: false,
            invalid: false,
            topic: null,
            scheduleType: null,
            period: null,
            time: null,
            endTime: null,
            timespan: false,
            duration: null,
            dailyDays: [],
            dailyDaysOfWeek: [],
            weeklyDays: [],
            monthlyDays: [],
            yearlyDay: null,
            yearlyMonth: null,
            minutesInterval: null,
            hourlyInterval: null,
            solarEvent: null,
            offset: null,
            solarDays: [],
            solarShowMore: [],
            solarEventEnd: null,
            offsetEnd: null,
            solarEventStart: true,
            solarEventTimespanTime: null,
            payloadType: true,
            payloadValue: true,
            customPayloadStart: null,
            customPayloadEnd: null,

            // Array of month names
            monthNames: [
                'january',
                'february',
                'march',
                'april',
                'may',
                'june',
                'july',
                'august',
                'september',
                'october',
                'november',
                'december'
            ],

            // Array of day names
            dayNames: [
                'sunday',
                'monday',
                'tuesday',
                'wednesday',
                'thursday',
                'friday',
                'saturday'
            ],

            // Array of solar event names
            solarEventNames: [
                'nightEnd',
                'nauticalDawn',
                'civilDawn',
                'sunrise',
                'sunriseEnd',
                'morningGoldenHourEnd',
                'solarNoon',
                'eveningGoldenHourStart',
                'sunsetStart',
                'sunset',
                'civilDusk',
                'nauticalDusk',
                'nightStart',
                'nadir'],

            // Dialog visibility
            modalTime: false,
            modalEndTime: false,

            dialog: false,
            dialogDelete: false,

            showExportDialog: false,
            showImportDialog: false,

            // Export dialog states
            exportLoading: false,
            exportedSchedule: '',
            exportError: '',
            exportTimeout: null,

            // Import dialog state
            importText: '',

            // Datatable
            expanded: [],
            expandedItem: null,
            updatingExpanded: false, // Flag to control updates

            // cron expression
            cronValue: '*/5 * * * *',
            nextCronValue: '',
            error: '',
            cronDescription: 'Every 5 minutes',
            cronExpValid: true,
            cronLoading: false,
            cronNextDates: null,
            cronNextTime: null,

            // Update check
            isUpdateAvailable: false,
            currentVersion: null,
            latestVersion: null
        }
    },

    computed: {
        ...mapState('data', ['messages']),
        label: function () {
            // Sanitize the html to avoid XSS attacks
            return this.getProperty('label')
        },
        // Validation rules
        rules () {
            return {
                required: value => !!value || this.t('required'),
                requiredNumber: value => (value !== undefined && value !== null && (value === 0 || !!value)) || this.t('required')
            }
        },

        fieldItems () {
            return defaultItems(this.locale)
        },

        fields () {
            return [
                { id: 'second', items: this.fieldItems.secondItems },
                { id: 'minute', items: this.fieldItems.minuteItems },
                { id: 'hour', items: this.fieldItems.hourItems },
                { id: 'day', items: this.fieldItems.dayItems },
                { id: 'month', items: this.fieldItems.monthItems },
                { id: 'dayOfWeek', items: this.fieldItems.dayOfWeekItems }
            ]
        },
        schedules () {
            return this.getProperty('schedules') || []
        },
        anyScheduleEnabled () {
            return this.filteredSchedules.some((schedule) => schedule.enabled)
        },
        formattedTime () {
            if (!this.time) return ''
            return this.formatTime(this.time)
        },
        formattedEndTime () {
            if (!this.endTime) return ''
            return this.formatTime(this.endTime)
        },
        formattedSolarEventTimespanTime () {
            if (!this.solarEventTimespanTime) return ''
            return this.formatTime(this.solarEventTimespanTime)
        },
        durationItems () {
            if (this.scheduleType === 'time') {
                if (this.period === 'minutes') {
                    return this.generateNumberArray(1, this.minutesInterval - 1)
                } else if (this.period === 'hourly') {
                    return this.generateNumberArray(1, (this.hourlyInterval * 60) - 1)
                }
            } else if (this.scheduleType === 'solar') {
                return this.generateNumberArray(1, 360)
            }
            return []
        },
        offsetItems () {
            return this.generateNumberArray(-120, 120)
        },

        localizedDaysOfMonth () {
            return this.daysOfMonth().map(day => {
                return {
                    value: day, // Underlying value (e.g., "1", "2", ..., "Last")
                    title: day === 'Last' ? this.t('lastDay') : day // Localized text for "Last"
                }
            })
        },

        uniqueTopics () {
            if (this.schedules && Array.isArray(this.schedules)) {
                const topics = this.schedules.map((schedule2) => schedule2.topic)
                return [...new Set(topics)]
            } else {
                return [] // Or handle the case where schedules are undefined
            }
        },

        isValidJson () {
            try {
                JSON.parse(this.importText)
                return true
            } catch (e) {
                return false
            }
        },
        filteredSchedules () {
            if (!this.schedules) {
                return []
            }

            const filteredSchedules = this.selectedTopic === 'All'
                ? this.schedules
                : this.schedules.filter((schedule) => schedule.topic === this.selectedTopic)

            return filteredSchedules.map((item, index) => {
                if (this.$vuetify.display.xs) {
                    return {
                        ...item,
                        rowNumber: index + 1
                    }
                }
                return item
            })
        },

        filteredHeaders () {
            return this.$vuetify.display.xs
                ? this.headers.map((header) => {
                    if (header.key === 'name') {
                        return { title: '#', align: 'start', key: 'rowNumber', width: '0%' }
                    }
                    return header
                })
                : this.headers
        },
        isTimespanSchedule () {
            return (this.scheduleType === 'time' && (this.period === 'daily' || this.period === 'weekly' || this.period === 'monthly' || this.period === 'yearly') && this.timespan === 'time') ||
                (this.scheduleType === 'time' && (this.period === 'minutes' || this.period === 'hourly') && this.timespan === 'duration') ||
                (this.scheduleType === 'solar' && (this.timespan === 'duration' || this.timespan === 'time' || this.timespan === 'solar')) ||
                (this.scheduleType === 'cron' && this.timespan === 'duration')
        },
        customPayloads () {
            return this.props.customPayloads || []
        },
        locale () {
            return this.props.locale || 'en'
        },
        localeMessages () {
            let baseMessages

            // Select the appropriate translations based on the `locale` prop.
            switch (this.locale) {
            case 'de':

                baseMessages = de
                break
            case 'es':
                baseMessages = es
                break
            case 'fr':
                baseMessages = fr
                break
            case 'it':
                baseMessages = it
                break
            case 'nl':
                baseMessages = nl
                break
            case 'en':
            default:
                baseMessages = en
                break
            }
            return baseMessages
        },
        menuItems () {
            return [
                { value: 'reportIssue', label: this.t('reportIssue'), icon: 'mdi-bug', color: 'red-lighten-1' },
                { value: 'featureRequest', label: this.t('featureRequest'), icon: 'mdi-lightbulb', color: 'yellow-darken-1' },
                { value: 'buyCoffee', label: this.t('buyCoffee'), icon: 'mdi-coffee', color: 'white' },
                {
                    value: 'updates',
                    label: this.isUpdateAvailable
                        ? this.t('updateAvailable')
                        : this.t('checkForUpdates'),
                    icon: 'mdi-update',
                    color: 'blue'
                }
            ]
        },
        headers () {
            return [
                { title: this.t('name'), align: 'start', key: 'name' },
                { title: this.t('description'), align: 'start', key: 'description' },
                { title: this.t('enabled'), align: 'center', key: 'action' }
            ]
        },

        // Localized months
        months () {
            return this.monthNames.map(month => ({ title: this.t(month), value: month }))
        },

        // Localized days of the week
        daysOfWeek () {
            return this.dayNames.map(day => ({ title: this.t(day), value: day }))
        },

        // Localized solar events
        solarEvents () {
            return this.solarEventNames.map(event => ({ title: this.t(event), value: event }))
        },
        // JSON representation of the exported schedule
        exportedScheduleJSON () {
            if (!this.exportedSchedule) return ''
            try {
                // Ensure we work with an object.
                const scheduleObject =
                    typeof this.exportedSchedule === 'object'
                        ? this.exportedSchedule
                        : JSON.parse(this.exportedSchedule)
                // Return a prettified JSON string.
                return JSON.stringify(scheduleObject, null, 2)
            } catch (error) {
                console.error('Error prettifying JSON:', error)
                return this.exportedSchedule
            }
        }
    },

    watch: {
        expanded (val) {
            if (this.updatingExpanded) return

            if (val.length > 0) {
                const lastItem = val[val.length - 1]

                // only request status if only one item is expanded
                if (val.length === 1) {
                    this.$nextTick(() => this.highlightExpandedRow())
                    const expandedItem = this.schedules.find(
                        schedule => schedule.name === lastItem
                    )
                    this.requestStatus(expandedItem)
                }

                // if only one item is expanded, don't collapse others
                if (this.expanded[0] === lastItem) return

                // Prevent recursive updates when updating expanded
                this.updatingExpanded = true
                this.expanded = [val[val.length - 1]]
                this.updatingExpanded = false
            }
        },
        yearlyMonth (newMonth) {
            const maxDays = this.getMaxDaysInMonth(newMonth)
            if (this.yearlyDay > maxDays) {
                this.yearlyDay = maxDays // Reset if the selected day is no longer valid
            }
        },
        timespan (value) {
            if (this.period === 'minutes') {
                if (!this.durationItems.includes((this.minutesInterval ?? 0) - 1)) {
                    this.duration = null
                    this.timespan = false
                }
            }

            if (this.isTimespanSchedule) {
                if (this.payloadType !== 'custom') {
                    this.payloadType = 'true_false'
                }
            } else {
                if (this.payloadType !== 'custom') {
                    this.payloadType = true
                }
            }
        },
        minutesInterval (value) {
            if (this.period === 'minutes') {
                if (!this.durationItems.includes(value - 1)) {
                    this.duration = null
                    this.timespan = false
                }
            }
        },
        cronValue (value) {
            if (this.scheduleType === 'cron') {
                this.getCronDescription(value)
            }
        },
        scheduleType (value) {
            if (value === 'cron') {
                this.getCronDescription(this.cronValue)
                if (this.timespan === 'time') {
                    this.timespan = false
                }
            } else if (value === 'time') {
                if (['daily', 'weekly', 'monthly', 'yearly'].includes(this.period)) {
                    if (this.timespan === 'duration') {
                        this.timespan = false
                    }
                } else if (['minutes', 'hourly'].includes(this.period)) {
                    if (this.timespan === 'time') {
                        this.timespan = false
                    }
                }
            }
        },
        dailyDays (value) {
            if (value?.length && Array.isArray(value) && this.period === 'daily' && this.scheduleType === 'time') {
                this.dailyDays = this.sortDaysOfWeek(value)
            }
        },
        weeklyDays (value) {
            if (value?.length && Array.isArray(value) && this.period === 'weekly' && this.scheduleType === 'time') {
                this.weeklyDays = this.sortDaysOfWeek(value)
            }
        },
        solarDays (value) {
            if (value?.length && Array.isArray(value) && this.scheduleType === 'solar') {
                this.solarDays = this.sortDaysOfWeek(value)
            }
        },
        period (value) {
            if (this.scheduleType === 'time' && ['daily', 'weekly', 'monthly', 'yearly'].includes(this.period)) {
                if (this.timespan === 'duration') {
                    this.timespan = false
                }
            }
            if (this.scheduleType === 'time' && ['minutes', 'hourly'].includes(this.period)) {
                if (this.timespan === 'time') {
                    this.timespan = false
                }
            }
        }

    },

    created () {
        this.$dataTracker(
            this.id,
            this.onInput,
            this.onLoad,
            this.onDynamicProperties
        )
        this.$socket.emit('widget-load', this.id)
    },
    mounted () {
        this.updateNowUTC()
        setInterval(this.updateNowUTC, 1000)
    },
    unmounted () {
    },

    methods: {
        onLoad (msg) {
            if (msg) {
                this.$store.commit('data/bind', { widgetId: this.id, msg })
                // if (msg.payload !== undefined) {
                //     this.updateDynamicProperty('schedules', msg.payload?.schedules || [])
                // }
            }
            const updateCheck = {
                action: 'checkUpdate',
                silent: true
            }
            this.$socket.emit('widget-action', this.id, updateCheck)
        },
        onInput (msg) {
            this.$store.commit('data/bind', { widgetId: this.id, msg })
            if (msg.payload?.cronExpression) {
                this.cronDescription = msg.payload?.cronExpression.description || ''
                this.cronExpValid = msg.payload?.cronExpression.valid || false
                this.cronNextDates = msg.payload?.cronExpression.nextDates || null
                this.cronNextTime = msg.payload?.cronExpression.prettyNext || null
                this.cronLoading = false
            }
            if (msg.payload?.updateResult) {
                const update = msg.payload.updateResult
                if (update.isUpdateAvailable) {
                    this.isUpdateAvailable = update.isUpdateAvailable
                }
                if (update.currentVersion) {
                    this.currentVersion = update.currentVersion
                }
                if (update.latestVersion) {
                    this.latestVersion = update.latestVersion
                }
                if (msg.event === 'updateCheck') {
                    const currentVersionLabel = this.t('currentVersion')
                    const latestVersionLabel = this.t('latestVersion')
                    if (!msg.silent) {
                        if (this.isUpdateAvailable) {
                            alert(
                                `${this.t('updateAvailable')}. ${currentVersionLabel}: ${update.currentVersion}, ${latestVersionLabel}: ${update.latestVersion}`
                            )
                        } else {
                            alert(
                                `${this.t('noUpdateAvailable')}. ${currentVersionLabel}: ${update.currentVersion}, ${latestVersionLabel}: ${update.latestVersion}`
                            )
                        }
                    }
                }
            }
            if (msg.payload?.exportResult) {
                if (this.showExportDialog && this.exportLoading) {
                    clearTimeout(this.exportTimeout)
                    this.exportLoading = false
                    this.exportedSchedule = msg.payload?.exportResult
                }
            }
        },
        onDynamicProperties (msg) {
            this.$store.commit('data/bind', { widgetId: this.id, msg })
            const updates = msg.ui_update
            if (!updates) {
                return
            }
            if (updates.schedules) {
                this.updateDynamicProperty('schedules', updates.schedules)
            }
            if (updates.label) {
                this.updateDynamicProperty('label', updates.label)
            }
        },
        isRowExpanded (item) { return this.expanded.includes(item.name) },
        highlightExpandedRow () { const rows = this.$el.querySelectorAll('tr'); rows.forEach(row => { const itemName = row.querySelector('td:first-child')?.textContent.trim(); if (this.expanded.includes(itemName)) { row.classList.add('highlighted-row') } else { row.classList.remove('highlighted-row') } }) },
        handleRowClick (item, index) {
            if (this.expanded.length === 0 || this.expanded[0] !== index.item.name) {
                this.expanded = [index.item.name]
            } else {
                this.expanded = []
            }
        },
        handleNextDatesExpand (isOpen) {
            if (!isOpen) {
                // You can add any other actions you want to perform here
            }
        },

        handleMenuItemClick (item) {
            if (item) {
                switch (item.value) {
                case 'reportIssue':
                    window.open('https://github.com/cgjgh/node-red-dashboard-2-ui-scheduler/issues/new?template=bug-report.md', '_blank')
                    break
                case 'featureRequest':
                    window.open('https://github.com/cgjgh/node-red-dashboard-2-ui-scheduler/issues/new?labels=enhancement', '_blank')
                    break
                case 'buyCoffee':
                    window.open('https://www.buymeacoffee.com/cgjgh', '_blank')
                    break
                case 'updates':
                    if (!this.isUpdateAvailable) {
                        const msg = {
                            action: 'checkUpdate'
                        }
                        this.$socket.emit('widget-action', this.id, msg)
                    } else {
                        window.open('https://github.com/cgjgh/node-red-dashboard-2-ui-scheduler/releases', '_blank')
                    }
                    break
                default:
                }
            }
        },

        filterSchedules () {
            // This will automatically trigger the computed property 'filteredSchedules'
        },
        generateNumberArray (min, max) {
            const array = []
            if (min > max) {
                return array
            }
            for (let i = min; i <= max; i++) {
                array.push(i)
            }
            return array
        },
        daysOfMonth () {
            if (this.period === 'yearly') {
                const maxDays = this.getMaxDaysInMonth(this.yearlyMonth)
                if (maxDays === 0) {
                    return []
                }
                return this.generateNumberArray(1, maxDays)
            } else {
                const days = this.generateNumberArray(1, 31)
                days.push('Last')
                return days
            }
        },
        getMaxDaysInMonth (monthName) {
            const month = this.monthNames.indexOf(monthName) + 1
            if (month === 0) {
                return 0
            }
            return month === 2 ? 29 : new Date(2024, month, 0).getDate()
        },
        isNameDuplicate () {
            return this.schedules
                ? this.schedules.some(
                    schedule =>
                        schedule.name.toLowerCase() === this.name.toLowerCase().trim() &&
                        schedule !== this.currentSchedule &&
                        !this.isEditing
                )
                : false
        },

        getCustomPayloadTitle (item) {
            if (!item) return '' // Return empty string if item is null or undefined

            let title = item.label || (item.type === 'json' ? JSON.stringify(item.value) : item.value)

            if (title === '' || title === null) {
                return '' // Return empty string if title is empty or null
            }

            if (title === 0) {
                return 0 // Return 0 if title is 0
            }

            // Truncate the title if it exceeds 30 characters
            if (typeof title === 'string' && title.length > 30) {
                title = title.slice(0, 30) + '...'
            }

            return title
        },

        mapSolarEvent (event, toTitle = true) {
            const found = this.solarEvents.find(e => toTitle ? e.value === event : e.title === event)
            return found ? (toTitle ? found.title : found.value) : event
        },
        mapDayOfWeek (value) {
            const day = this.daysOfWeek.find(day => day.value === value)
            return day ? day.title : ''
        },
        mapMonth (value) {
            const month = this.months.find(month => month.value === value)
            return month ? month.title : ''
        },
        sendSchedule (schedule) {
            const msg = { action: 'submit', payload: { schedules: [schedule] } }
            this.$socket.emit('widget-action', this.id, msg)
        },
        updateCronValue (expression) {
            this.cronValue = expression
        },
        getCronDescription (expression) {
            this.cronLoading = true
            const msg = { action: 'describe', payload: { cronExpression: expression } }
            this.$socket.emit('widget-action', this.id, msg)
            setTimeout(() => {
                if (this.cronLoading) {
                    this.cronLoading = false
                    this.cronExpValid = false
                    this.cronDescription = '-'
                }
            }, 5000)
        },
        formatTime (time) {
            if (!time) return ''
            const [hours, minutes] = time.split(':')
            if (this.props.use24HourFormat) {
                return `${hours}:${minutes}`
            } else {
                const period = hours >= 12 ? 'PM' : 'AM'
                const formattedHours = hours % 12 || 12
                return `${formattedHours}:${minutes} ${period}`
            }
        },
        updateNowUTC () { this.now = new Date().getTime() },
        toTitleCase (str) {
            return str.charAt(0).toUpperCase() + str.slice(1)
        },
        openDialog () {
            this.dialog = true
            this.isEditing = false
            this.resetForm()
        },
        closeDialog () {
            this.dialog = false
            this.validationResult = {
                alert: false,
                message: ''
            }
        },
        progressValue (item) {
            // Destructure currentStartTime from item and nextEndUTC from item.endTask
            const { currentStartTime, endTask: { nextDate: nextEndDate } = {} } = item

            // Ensure the dates are converted into timestamps
            const nextEndMillis = nextEndDate ? new Date(nextEndDate).getTime() : null
            const currentStartMillis = currentStartTime ? new Date(currentStartTime).getTime() : null

            if (!nextEndMillis || !currentStartMillis) {
                return 0
            }

            const value = Math.round(((this.now - currentStartMillis) / (nextEndMillis - currentStartMillis)) * 100)

            return Math.min(Math.max(value, 0), 100) // Ensure the value stays between 0 and 100
        },

        progressColor (item) {
            const progress = this.progressValue(item) / 100 // Normalize to 0-1 range
            const hue = (progress * 120) / 360
            const saturation = 1
            const value = 1
            return hsvToRgb(hue, saturation, value)
        },

        saveSchedule () {
            this.validationResult = this.validateSchedule()
            if (this.validationResult.alert) {
                return
            }
            const newSchedule = {
                id: this.scheduleId,
                name: this.name,
                enabled: this.enabled,
                topic: this.topic,
                scheduleType: this.scheduleType
            }

            if (this.scheduleType === 'time') {
                newSchedule.period = this.period

                if (['daily', 'weekly', 'monthly', 'yearly'].includes(this.period)) {
                    newSchedule.time = this.time
                    newSchedule.days = this.getSelectedDays()
                    if (this.timespan === 'time') {
                        newSchedule.timespan = this.timespan
                        newSchedule.endTime = this.endTime
                    } else {
                        newSchedule.timespan = false
                    }
                }

                if (this.period === 'yearly') {
                    newSchedule.month = this.yearlyMonth
                }

                if (this.period === 'minutes') {
                    newSchedule.minutesInterval = this.minutesInterval
                    if (this.timespan === 'duration') {
                        newSchedule.timespan = this.timespan
                        newSchedule.duration = this.duration
                    } else {
                        newSchedule.timespan = false
                    }
                }

                if (this.period === 'hourly') {
                    newSchedule.hourlyInterval = this.hourlyInterval
                    if (this.timespan === 'duration') {
                        newSchedule.timespan = this.timespan
                        newSchedule.duration = this.duration
                    } else {
                        newSchedule.timespan = false
                    }
                }
            } else if (this.scheduleType === 'solar') {
                newSchedule.solarEvent = this.solarEvent
                newSchedule.offset = this.offset

                if (this.timespan === 'duration') {
                    newSchedule.timespan = this.timespan
                    newSchedule.duration = this.duration
                } else if (this.timespan === 'time') {
                    newSchedule.timespan = this.timespan
                    newSchedule.solarEventStart = this.solarEventStart
                    newSchedule.solarEventTimespanTime = this.solarEventTimespanTime
                } else if (this.timespan === 'solar') {
                    newSchedule.timespan = this.timespan
                    newSchedule.solarEventEnd = this.solarEventEnd
                    newSchedule.offsetEnd = this.offsetEnd
                } else {
                    newSchedule.timespan = false
                }

                if (this.solarDays && this.solarDays.length > 0 && this.solarDays.length < 7) {
                    newSchedule.solarDays = this.solarDays
                }
            } else if (this.scheduleType === 'cron') {
                newSchedule.startCronExpression = this.cronValue
                if (this.timespan === 'duration') {
                    newSchedule.timespan = this.timespan
                    newSchedule.duration = this.duration
                } else {
                    newSchedule.timespan = false
                }
            }

            if (this.isTimespanSchedule) {
                newSchedule.payloadType = this.payloadType
                if (this.payloadType !== 'custom') {
                    newSchedule.payloadValue = true
                    newSchedule.endPayloadValue = false
                } else {
                    newSchedule.payloadValue = this.customPayloadStart
                    newSchedule.endPayloadValue = this.customPayloadEnd
                }
            } else {
                newSchedule.payloadType = this.payloadType
                if (this.payloadType !== 'custom' && this.payloadType !== 'true_false') {
                    newSchedule.payloadValue = this.payloadType
                } else if (this.payloadType === 'custom') {
                    newSchedule.payloadValue = this.customPayloadStart
                }
            }

            if (this.isEditing) {
                this.currentSchedule = newSchedule
            } else {
                if (!this.schedules) {
                    this.updateDynamicProperty('schedules', [])
                }
                // this.schedules.push(newSchedule)
            }
            this.sendSchedule(newSchedule)
            this.closeDialog()
            this.expanded = []
        },

        validateSchedule () {
            if (!this.name) {
                return { alert: true, message: this.t('scheduleNameRequired') }
            }

            if (this.isNameDuplicate()) {
                return { alert: true, message: this.t('scheduleNameUnique') }
            }

            if (!this.topic) {
                return { alert: true, message: this.t('topicRequired') }
            }

            if (this.scheduleType === 'time') {
                if (!this.period) {
                    return { alert: true, message: this.t('periodRequired') }
                }
                if (['daily', 'weekly', 'monthly', 'yearly'].includes(this.period)) {
                    if (!this.time) {
                        return { alert: true, message: this.t('startTimeRequired') }
                    }
                    if (this.timespan === 'time') {
                        if (!this.endTime) {
                            return { alert: true, message: this.t('endTimeRequired') }
                        }
                    }
                    const days = this.getSelectedDays()
                    if (!days.length) {
                        // Assuming your translation helper supports message interpolation.
                        return {
                            alert: true,
                            message: this.t('daysRequiredForPeriod', { period: this.period })
                        }
                    }
                } else if (this.period === 'minutes') {
                    if (!this.minutesInterval) {
                        return { alert: true, message: this.t('minutesIntervalRequired') }
                    }
                    if (this.timespan === 'duration' && !this.duration) {
                        return {
                            alert: true,
                            message: this.t('minutesDurationRequired')
                        }
                    }
                } else if (this.period === 'hourly') {
                    if (!this.hourlyInterval) {
                        return { alert: true, message: this.t('hourlyIntervalRequired') }
                    }
                    if (this.timespan === 'duration' && !this.duration) {
                        return {
                            alert: true,
                            message: this.t('hourlyDurationRequired')
                        }
                    }
                }
            } else if (this.scheduleType === 'solar') {
                if (!this.props.defaultLocation || this.defaultLocation === '') {
                    return { alert: true, message: this.t('solarLocationRequired') }
                }
                if (!this.solarEvent) {
                    return { alert: true, message: this.t('solarEventRequired') }
                }
                if (!this.offset && this.offset !== 0) {
                    return { alert: true, message: this.t('solarOffsetRequired') }
                }
                if (this.timespan === 'duration' && !this.duration) {
                    return {
                        alert: true,
                        message: this.t('solarDurationRequired')
                    }
                }
                if (this.timespan === 'time') {
                    if (this.solarEventStart === null) {
                        return {
                            alert: true,
                            message: this.t('solarTimeDefinitionRequired')
                        }
                    }
                    if (!this.solarEventTimespanTime) {
                        return {
                            alert: true,
                            message: this.t('solarTimeRequired')
                        }
                    }
                }
                if (this.timespan === 'solar') {
                    if (!this.solarEventEnd) {
                        return { alert: true, message: this.t('solarEventRequired') }
                    }
                    if (!this.offsetEnd && this.offsetEnd !== 0) {
                        return { alert: true, message: this.t('solarOffsetRequired') }
                    }
                }
            } else if (this.scheduleType === 'cron') {
                if (!this.cronValue || !this.cronExpValid) {
                    return { alert: true, message: this.t('cronValidRequired') }
                }
            }

            if (this.payloadType === null) {
                return { alert: true, message: this.t('outputValueRequired') }
            }

            if (this.payloadType === 'custom') {
                if (this.customPayloadStart === null) {
                    return { alert: true, message: this.t('customOutputRequired') }
                }
                if (this.customPayloadEnd === null && this.isTimespanSchedule) {
                    return { alert: true, message: this.t('customOutputRequired') }
                }
            }

            return { alert: false, message: '' }
        },

        getSelectedDays () {
            if (this.period === 'daily') {
                return this.dailyDays
            } else if (this.period === 'weekly') {
                return this.weeklyDays
            } else if (this.period === 'monthly') {
                return this.monthlyDays
            } else if (this.period === 'yearly') {
                return [this.yearlyDay]
            }
            return []
        },
        sortDaysOfWeek (days) {
            const dayOrder = this.daysOfWeek.map(day => day.value)
            return days.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b))
        },

        getChipColor (day) {
            const colors = {
                sunday: 'red',
                monday: 'yellow-darken-2',
                tuesday: 'orange-darken-1',
                wednesday: 'green',
                thursday: 'purple-lighten-1',
                friday: 'blue',
                saturday: 'pink'
            }

            return colors[day]
        },
        toggleSchedule (item) {
            const enabled = !item.enabled
            if (item.id) {
                this.$socket.emit('widget-action', this.id, {
                    action: 'setEnabled',
                    payload: { id: item.id, enabled },
                    topic: item.topics
                })
            } else if (item.name) { // remove later
                this.$socket.emit('widget-action', this.id, {
                    action: 'setEnabled',
                    payload: { name: item.name, enabled },
                    topic: item.topics
                })
            }
        },
        toggleAllSchedules () {
            const enabled = !this.anyScheduleEnabled

            const ids = this.filteredSchedules.map(schedule => schedule.id).filter(id => id)

            if (ids.length > 0) {
                this.$socket.emit('widget-action', this.id, {
                    action: 'setEnabled',
                    payload: { ids, enabled, all: true },
                    topic: this.selectedTopic
                })
            } else {
                const names = this.filteredSchedules.map(schedule => schedule.name).filter(name => name)

                if (names.length > 0) {
                    this.$socket.emit('widget-action', this.id, {
                        action: 'setEnabled',
                        payload: { names, enabled, all: true },
                        topic: this.selectedTopic
                    })
                }
            }
        },

        requestStatus (item) {
            if (item.id) {
                this.$socket.emit('widget-action', this.id, {
                    action: 'requestStatus',
                    payload: {
                        id: item.id
                    }
                })
            } else if (item.name) { // remove later
                this.$socket.emit('widget-action', this.id, {
                    action: 'requestStatus',
                    payload: {
                        name: item.name
                    }
                })
            }
        },
        toggleExpandedItem (item) {
            this.expandedItem = this.expandedItem === item ? null : item
            this.requestStatus(item)
        },
        editSchedule (item) {
            this.resetForm() // Initialize with defaults first

            this.currentSchedule = item
            this.isEditing = true

            this.scheduleId = item.id || this.scheduleId
            this.name = item.name || this.name
            this.enabled = item.enabled !== undefined ? item.enabled : this.enabled
            this.invalid = item.invalid !== undefined ? item.invalid : this.invalid
            this.topic = item.topic || this.topic
            this.scheduleType = item.scheduleType || this.scheduleType
            this.period = item.period || this.period
            if (item.period === 'daily') {
                this.dailyDays = item.days || this.dailyDays
            } else if (item.period === 'weekly') {
                this.weeklyDays = item.days || this.weeklyDays
            } else if (item.period === 'monthly') {
                this.monthlyDays = item.days ? item.days.map(day => day === 'Last' ? 'Last' : Number(day)) : this.monthlyDays
            } else if (item.period === 'yearly') {
                this.yearlyDay = item.days ? item.days[0] : this.yearlyDay
            }
            this.time = item.time || this.time
            this.minutesInterval = item.minutesInterval || this.minutesInterval
            this.timespan = item.timespan !== undefined ? item.timespan : this.timespan
            this.duration = item.duration || this.duration
            this.hourlyInterval = item.hourlyInterval || this.hourlyInterval
            this.yearlyMonth = item.month || this.yearlyMonth
            this.endTime = item.endTime || this.endTime
            this.solarEvent = item.solarEvent || this.solarEvent
            this.solarDays = item.solarDays || this.solarDays
            const length = this.solarDays?.length
            this.solarShowMore = length > 0 && length < 7 ? ['moreOptions'] : []
            this.offset = item.offset || this.offset
            this.solarEventEnd = item.solarEventEnd || this.solarEventEnd
            this.offsetEnd = item.offsetEnd || this.offsetEnd
            this.solarEventTimespanTime = item.solarEventTimespanTime || this.solarEventTimespanTime
            this.solarEventStart = item.solarEventStart !== undefined ? item.solarEventStart : this.solarEventStart

            if (this.scheduleType === 'cron') {
                this.cronValue = item.startCronExpression || this.cronValue
            }

            if (this.scheduleType === 'cron') {
                this.cronValue = item.startCronExpression || this.cronValue
            }
            this.payloadValue = item.payloadValue !== undefined ? item.payloadValue : this.payloadValue
            this.payloadType = item.payloadType !== undefined ? item.payloadType : this.payloadType
            if (item.payloadType !== undefined && item.payloadType === 'custom') {
                if (item.payloadValue !== undefined) {
                    const payload = this.props.customPayloads.find(payload => payload.id === item.payloadValue)
                    this.customPayloadStart = payload || null
                }

                if (item.endPayloadValue !== undefined) {
                    const payload = this.props.customPayloads.find(payload => payload.id === item.endPayloadValue)
                    this.customPayloadEnd = payload || null
                }
            }

            this.dialog = true
        },

        resetForm () {
            this.scheduleId = null
            const baseName = this.t('schedule')
            let newName = baseName
            let index = 2
            const uiOptions = this.getDefaultUIOptions(this.props)

            if (this.schedules) {
                while (this.schedules.some(schedule => schedule.name === newName)) {
                    newName = `${baseName} ${index}`
                    index++
                }
            }

            this.name = newName
            if (Array.isArray(this.props.topics) && this.props.topics.length > 0) {
                if (this.selectedTopic === 'All') {
                    this.topic = this.props.topics[0]
                } else {
                    this.topic = this.selectedTopic
                }
            } else {
                this.topic = null
            }
            this.enabled = true
            this.invalid = false
            this.scheduleType = uiOptions.scheduleType || 'time'
            this.period = uiOptions.period || 'daily'
            this.dailyDays = [...this.daysOfWeek.map(day => day.value)]
            this.weeklyDays = ['monday']
            this.monthlyDays = [1]
            this.yearlyDay = 1
            this.yearlyMonth = 'january'
            this.time = '00:00'
            this.endTime = '00:05'
            this.minutesInterval = 10
            this.hourlyInterval = 1
            this.solarEvent = 'sunrise'
            this.offset = 0
            this.solarEventEnd = 'sunset'
            this.offsetEnd = 0
            this.solarDays = [...this.daysOfWeek.map(day => day.value)]
            this.solarEventStart = true
            this.solarEventTimespanTime = '00:00'
            this.cronValue = '*/5 * * * *'
            this.timespan = false
            this.duration = 1
            this.payloadValue = true
            this.payloadType = true
            this.customPayloadStart = null
            this.customPayloadEnd = null
        },

        getDefaultUIOptions (props) {
            if (!props) return {}
            const options = {}

            // Handle scheduleType
            const scheduleTypes = ['uiOptionTime', 'uiOptionSolar', 'uiOptionCron']
            for (const type of scheduleTypes) {
                if (props[type]) {
                    options.scheduleType = type.replace('uiOption', '').toLowerCase()
                    break
                }
            }
            if (!options.scheduleType) {
                options.scheduleType = 'time' // Default value if none match
            }

            // Handle period
            const periods = {
                uiOptionDay: 'daily',
                uiOptionHour: 'hourly',
                uiOptionMinute: 'minutes',
                uiOptionWeek: 'weekly',
                uiOptionMonth: 'monthly',
                uiOptionYear: 'yearly'
            }

            for (const [prop, value] of Object.entries(periods)) {
                if (props[prop]) {
                    options.period = value
                    break
                }
            }
            if (!options.period) {
                options.period = 'daily' // Default value if none match
            }
            return options
        },

        setEndTime () {
            if (this.timespan !== 'time') {
                this.endTime = null
            } else {
                if (!this.time) {
                    this.endTime = null
                } else {
                    const [hours, minutes] = this.time.split(':').map(Number)
                    let endTimeHours = hours
                    let endTimeMinutes = minutes + 5

                    if (endTimeMinutes >= 60) {
                        endTimeMinutes -= 60
                        endTimeHours += 1
                    }

                    if (endTimeHours >= 24) {
                        endTimeHours -= 24
                    }

                    const formattedHours = String(endTimeHours).padStart(2, '0')
                    const formattedMinutes = String(endTimeMinutes).padStart(2, '0')

                    this.endTime = `${formattedHours}:${formattedMinutes}`
                }
            }
        },
        openDeleteDialog () {
            this.dialogDelete = true
        },
        closeDelete () {
            this.dialogDelete = false
        },
        deleteConfirm () {
            if (this.currentSchedule) {
                if (this.currentSchedule.id) {
                    const index = this.schedules.findIndex(schedule => schedule.id === this.currentSchedule.id)
                    if (index > -1) {
                        this.schedules.splice(index, 1)
                        this.$socket.emit('widget-action', this.id, {
                            action: 'remove',
                            payload: { id: this.currentSchedule.id }
                        })
                    }
                } else { // remove later
                    const index = this.schedules.findIndex(schedule => schedule.name === this.currentSchedule.name)
                    if (index > -1) {
                        this.schedules.splice(index, 1)
                        this.$socket.emit('widget-action', this.id, {
                            action: 'remove',
                            payload: { name: this.currentSchedule.name }
                        })
                    }
                }
                this.closeDialog()
            }
            this.dialogDelete = false
        },

        // Opens the export dialog and initiates the export request.
        openExportDialog () {
            this.showExportDialog = true
            this.exportLoading = true
            this.exportError = ''
            this.exportedSchedule = ''

            // Start a timeout so that if the schedule isn't received in 5s, show error.
            this.exportTimeout = setTimeout(() => {
                if (this.exportLoading) {
                    this.exportLoading = false
                    this.exportError = this.t('exportTimeout')
                }
            }, 5000)

            // Send the export request via socket.
            // (Adjust the action and payload as necessary.)
            this.$socket.emit('widget-action', this.id, {
                action: 'exportSchedule',
                payload: { id: this.scheduleId }
            })
        },
        // Copies the exported schedule text to the clipboard.
        copyExport () {
            navigator.clipboard
                .writeText(this.exportedScheduleJSON)
                .then(() => {
                    this.copiedAlert = true
                    // Auto-dismiss after 3 seconds.
                    setTimeout(() => {
                        this.copiedAlert = false
                    }, 3000)
                })
                .catch((err) => {
                    console.error('Failed to copy:', err)
                })
        },
        closeExportDialog () {
            this.showExportDialog = false
            // Remove the socket listener for cleanliness.
            // this.$socket.off('exported-schedule')
        },
        // Opens the import dialog.
        openImportDialog () {
            this.showImportDialog = true
            this.importText = ''
        },
        closeImportDialog () {
            this.showImportDialog = false
        },
        // Handles the import action: parses the text, iterates through keys,
        // and calls editSchedule() for each schedule item.
        handleImport () {
            let parsedData
            try {
                parsedData = JSON.parse(this.importText)
            } catch (e) {
                // Shouldn't happen because the button is disabled if JSON is invalid.
                return
            }

            // If parsedData is an object with multiple schedule entries,
            // get its keys and import only the first schedule.
            if (Array.isArray(parsedData)) {
                parsedData = parsedData[0]
            }

            const item = parsedData
            this.closeImportDialog()
            this.scheduleId = item.id || this.scheduleId
            this.name = item.name || this.name
            this.enabled = item.enabled !== undefined ? item.enabled : this.enabled
            this.topic = item.topic || this.topic
            this.scheduleType = item.scheduleType || this.scheduleType
            this.period = item.period || this.period
            if (item.period === 'daily') {
                this.dailyDays = item.days || this.dailyDays
            } else if (item.period === 'weekly') {
                this.weeklyDays = item.days || this.weeklyDays
            } else if (item.period === 'monthly') {
                this.monthlyDays = item.days ? item.days.map(day => day === 'Last' ? 'Last' : Number(day)) : this.monthlyDays
            } else if (item.period === 'yearly') {
                this.yearlyDay = item.days ? item.days[0] : this.yearlyDay
            }
            this.time = item.time || this.time
            this.minutesInterval = item.minutesInterval || this.minutesInterval
            this.timespan = item.timespan !== undefined ? item.timespan : this.timespan
            this.duration = item.duration || this.duration
            this.hourlyInterval = item.hourlyInterval || this.hourlyInterval
            this.yearlyMonth = item.month || this.yearlyMonth
            this.endTime = item.endTime || this.endTime
            this.solarEvent = item.solarEvent || this.solarEvent
            this.solarDays = item.solarDays || this.solarDays
            const length = this.solarDays?.length
            this.solarShowMore = length > 0 && length < 7 ? ['moreOptions'] : []
            this.offset = item.offset || this.offset
            this.solarEventTimespanTime = item.solarEventTimespanTime || this.solarEventTimespanTime
            this.solarEventStart = item.solarEventStart !== undefined ? item.solarEventStart : this.solarEventStart

            if (this.scheduleType === 'cron') {
                this.cronValue = item.startCronExpression || this.cronValue
            }

            if (this.scheduleType === 'cron') {
                this.cronValue = item.startCronExpression || this.cronValue
            }
            this.payloadValue = item.payloadValue !== undefined ? item.payloadValue : this.payloadValue
            this.payloadType = item.payloadType !== undefined ? item.payloadType : this.payloadType
            if (item.payloadType !== undefined && item.payloadType === 'custom') {
                if (item.payloadValue !== undefined) {
                    const payload = this.props.customPayloads.find(payload => payload.id === item.payloadValue)
                    this.customPayloadStart = payload || null
                }

                if (item.endPayloadValue !== undefined) {
                    const payload = this.props.customPayloads.find(payload => payload.id === item.endPayloadValue)
                    this.customPayloadEnd = payload || null
                }
            }
        },

        copyToClipboard (item) {
            const el = document.createElement('textarea')
            el.value = JSON.stringify(item)
            document.body.appendChild(el)
            el.select()
            document.execCommand('copy')
            document.body.removeChild(el)
            alert('Copied to clipboard!')
        },

        // Simple translation function that returns the message for a given key.
        // If the key is not found, it falls back to displaying the key.
        t (key) {
            return this.localeMessages[key] || key
        }
    }
}
</script>

<style>
@import "../stylesheets/ui-scheduler.css";
</style>
