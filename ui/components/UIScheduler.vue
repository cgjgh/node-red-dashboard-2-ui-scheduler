<!-- eslint-disable vuetify/no-deprecated-components -->
<template class="px-0 py-2 main">
    <v-container class="pa-0 main" style="border: 1.5px solid grey; border-radius: 10px">
        <v-toolbar border color="navigation-background" rounded="lg">
            <v-toolbar-title
                :class="['truncate-text', { 'text-body-1': selectedTopic !== 'All' && $vuetify.display.xs }]"
                :style="{ margin: (selectedTopic !== 'All' && $vuetify.display.xs) ? '2px !important' : '20px' }"
            >
                {{ props.label }}
            </v-toolbar-title>
            <v-select
                v-model="selectedTopic" :items="['All', ...uniqueTopics]" label="Topic"
                style="max-width: fit-content" rounded="lg" variant="solo-inverted"
                @update:model-value="filterSchedules"
            />
            <v-switch
                v-if="selectedTopic !== 'All'" v-model="anyScheduleEnabled" color="primary" hide-details
                class="pl-3" @click.stop="toggleAllSchedules"
            />

            <v-btn @click="openDialog()">
                <v-icon>mdi-plus</v-icon>
            </v-btn>
        </v-toolbar>
        <v-data-table
            v-model:expanded="expanded" :headers="filteredHeaders" :items="filteredSchedules"
            hide-default-footer density="compact" :show-expand="!$vuetify.display.xs" item-value="name"
            :expand="expandedItem" items-per-page @click:row="handleRowClick"
        >
            <template #item.rowNumber="{ item }">
                <v-chip :color="item.active === undefined ? 'gray' : (item.active ? 'green' : 'red')">
                    {{ item.rowNumber }}
                </v-chip>
            </template>

            <template #item.name="{ item }">
                <div v-if="item.active === undefined">{{ item.name }}</div>
                <v-chip v-else :color="item.active ? 'green' : 'red'">
                    {{ item.name }}
                </v-chip>
            </template>
            <template #item.action="{ item }">
                <div style="padding-right: 0; margin-right: 0; width: fit-content">
                    <v-switch
                        v-model="item.enabled" color="primary" hide-details :disabled="item.isStatic"
                        @click.stop="toggleSchedule(item)"
                    />
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
                                        v-if="item" icon color="primary" :disabled="item.isStatic || item.readonly"
                                        @click="editSchedule(item)"
                                    >
                                        <v-icon>mdi-pencil</v-icon>
                                    </v-btn>
                                </v-card-title>
                                <v-card-text>
                                    <v-row>
                                        <v-list>
                                            <v-list-subheader>Event Details</v-list-subheader>
                                            <v-list-item v-if="item.topic" class="prepend-icon-spacing">
                                                <template #prepend>
                                                    <v-icon>mdi-sitemap-outline</v-icon>
                                                </template>
                                                <v-list-item-title>Topic</v-list-item-title>
                                                <v-list-item-subtitle>{{ item.topic }}</v-list-item-subtitle>
                                            </v-list-item>
                                            <v-list-item v-if="item.period" class="prepend-icon-spacing">
                                                <template #prepend>
                                                    <v-icon>mdi-calendar-expand-horizontal</v-icon>
                                                </template>
                                                <v-list-item-title>Period</v-list-item-title>
                                                <v-list-item-subtitle>
                                                    {{ toTitleCase(item.period) }}
                                                </v-list-item-subtitle>
                                            </v-list-item>
                                            <v-list-item class="prepend-icon-spacing">
                                                <template #prepend>
                                                    <v-icon>mdi-email-arrow-right-outline</v-icon>
                                                </template>
                                                <v-list-item-title>Output</v-list-item-title>
                                                <v-list-item-subtitle class="pb-2">
                                                    <template v-if="(item.hasDuration || item.hasEndTime) && item.payloadType === 'true_false'">
                                                        <v-chip density="compact" color="green">True</v-chip>
                                                        <span> on start,</span>
                                                        <v-chip density="compact" color="red">False</v-chip>
                                                        <span> on end</span>
                                                    </template>
                                                    <template v-else-if="item.payloadValue === true">
                                                        <v-chip density="compact" color="green">
                                                            True
                                                        </v-chip>
                                                    </template>
                                                    <template v-else-if="item.payloadValue === false">
                                                        <v-chip density="compact" color="red">
                                                            False
                                                        </v-chip>
                                                    </template>
                                                    <template v-else>
                                                        <v-chip density="compact" color="blue">
                                                            Custom
                                                        </v-chip>
                                                    </template>
                                                </v-list-item-subtitle>
                                            </v-list-item>
                                            <v-divider />
                                            <v-list-subheader v-if="item.period">Time Details</v-list-subheader>
                                            <v-list-item v-if="item.yearlyMonth" class="prepend-icon-spacing">
                                                <template #prepend>
                                                    <v-icon>mdi-calendar-month</v-icon>
                                                </template>
                                                <v-list-item-title>Month</v-list-item-title>
                                                <v-list-item-subtitle>{{ item.yearlyMonth }}</v-list-item-subtitle>
                                            </v-list-item>
                                            <v-list-item v-if="item.days" lines="two" class="prepend-icon-spacing">
                                                <template #prepend>
                                                    <v-icon>mdi-calendar-range</v-icon>
                                                </template>
                                                <v-list-item-title>Days</v-list-item-title>
                                                <v-list-item-subtitle>
                                                    {{ item.period === 'monthly' || item.period ===
                                                        'yearly' ? item.days.join(', ') :
                                                            item.days.map((day) => day.slice(0, 3)).join(', ') }}
                                                </v-list-item-subtitle>
                                            </v-list-item>
                                            <v-list-item v-if="item.time" class="prepend-icon-spacing">
                                                <template #prepend>
                                                    <v-icon :icon="item.hasEndTime ? 'mdi-clock-start' : 'mdi-clock'" />
                                                </template>
                                                <v-list-item-title :class="{ 'text-green': item.hasEndTime }">
                                                    {{
                                                        item.hasEndTime ? 'Start Time' : 'Time' }}
                                                </v-list-item-title>
                                                <v-list-item-subtitle>{{ formatTime(item.time) }}</v-list-item-subtitle>
                                            </v-list-item>
                                            <v-list-item v-if="item.hasEndTime" class="prepend-icon-spacing">
                                                <template #prepend>
                                                    <v-icon>mdi-clock-end</v-icon>
                                                </template>
                                                <v-list-item-title class="text-red">End Time</v-list-item-title>
                                                <v-list-item-subtitle>
                                                    {{ formatTime(item.endTime) }}
                                                </v-list-item-subtitle>
                                            </v-list-item>
                                            <v-list-item v-if="item.minutesInterval" class="prepend-icon-spacing">
                                                <template #prepend>
                                                    <v-icon>mdi-repeat</v-icon>
                                                </template>
                                                <v-list-item-title>Interval (minutes)</v-list-item-title>
                                                <v-list-item-subtitle>{{ item.minutesInterval }}</v-list-item-subtitle>
                                            </v-list-item>
                                            <v-list-item v-if="item.hourlyInterval" class="prepend-icon-spacing">
                                                <template #prepend>
                                                    <v-icon>mdi-repeat</v-icon>
                                                </template>
                                                <v-list-item-title>Interval (hours)</v-list-item-title>
                                                <v-list-item-subtitle>{{ item.hourlyInterval }}</v-list-item-subtitle>
                                            </v-list-item>
                                            <v-list-item v-if="item.hasDuration" class="prepend-icon-spacing">
                                                <template #prepend>
                                                    <v-icon>mdi-timer-sand</v-icon>
                                                </template>
                                                <v-list-item-title>Duration</v-list-item-title>
                                                <v-list-item-subtitle>{{ item.duration }} minutes</v-list-item-subtitle>
                                            </v-list-item>
                                            <v-list-subheader v-if="item.solarEvent">Solar</v-list-subheader>
                                            <v-list-item v-if="item.solarEvent" class="prepend-icon-spacing">
                                                <template #prepend>
                                                    <v-icon>mdi-weather-sunset</v-icon>
                                                </template>
                                                <v-list-item-title>Solar Event</v-list-item-title>
                                                <v-list-item-subtitle>
                                                    {{ mapSolarEvent(item.solarEvent) }}
                                                </v-list-item-subtitle>
                                            </v-list-item>
                                            <v-list-item v-if="item.offset" class="prepend-icon-spacing">
                                                <template #prepend>
                                                    <v-icon>mdi-plus-minus</v-icon>
                                                </template>
                                                <v-list-item-title>Offset</v-list-item-title>
                                                <v-list-item-subtitle>{{ item.offset }}</v-list-item-subtitle>
                                            </v-list-item>
                                            <v-list-subheader v-if="item.scheduleType === 'cron'">
                                                Cron
                                            </v-list-subheader>
                                            <v-list-item
                                                v-if="item.scheduleType === 'cron'" lines="two"
                                                class="prepend-icon-spacing"
                                            >
                                                <template #prepend>
                                                    <v-icon>mdi-code-brackets</v-icon>
                                                </template>
                                                <v-list-item-title>Cron Expression</v-list-item-title>
                                                <v-list-item-subtitle>
                                                    {{ item.startCronExpression
                                                    }}
                                                </v-list-item-subtitle>
                                            </v-list-item>
                                            <v-divider />
                                            <v-list-subheader>Next</v-list-subheader>
                                            <v-list-group>
                                                <template #activator="{ isOpen, props }">
                                                    <v-list-item
                                                        v-bind="props"
                                                        class="prepend-icon-spacing no-padding-start" lines="two"
                                                        @click="handleNextDatesExpand(isOpen)"
                                                    >
                                                        <template #prepend>
                                                            <v-icon>mdi-calendar-arrow-right</v-icon>
                                                        </template>
                                                        <v-list-item-title>Next Date</v-list-item-title>
                                                        <v-list-item-subtitle>{{ item.nextDate }}</v-list-item-subtitle>
                                                    </v-list-item>
                                                </template>

                                                <v-list-item
                                                    v-for="(date, index) in item.nextDates" :key="index"
                                                    :class="{ 'no-padding-start': true }" lines="two"
                                                >
                                                    <v-list-item-subtitle>
                                                        <strong>{{ index + 1 }}.&nbsp;&nbsp;</strong>{{ date }}
                                                    </v-list-item-subtitle>
                                                </v-list-item>
                                            </v-list-group>

                                            <v-list-item
                                                v-if="item.nextDescription" lines="two"
                                                class="prepend-icon-spacing" @click="requestStatus(item)"
                                            >
                                                <template #prepend>
                                                    <v-icon>mdi-calendar-text</v-icon>
                                                </template>
                                                <v-list-item-title>Next Description</v-list-item-title>
                                                <v-list-item-subtitle>{{ item.nextDescription }}</v-list-item-subtitle>
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
                <div class="text-center my-4">No Schedules</div>
            </template>
        </v-data-table>

        <v-dialog v-model="dialog" :fullscreen="$vuetify.display.xs" rounded="lg" color="background" max-width="500px">
            <v-row v-if="validationResult.alert">
                <v-alert v-model="validationResult.alert" title="Error" min-height="fit-content" type="error" closable>
                    {{ validationResult.message }}
                </v-alert>
            </v-row>
            <v-card :class="{ 'bordered-card': !$vuetify.display.xs, 'border-none': $vuetify.display.xs }" class="pa-2">
                <v-card-title class="d-flex align-items-center justify-space-between pb-0">
                    <span class="text-h5">{{ isEditing ? 'Edit Schedule' : 'New Schedule' }}</span>
                    <div class="d-flex align-items-center">
                        <v-switch
                            v-model="enabled" :label="enabled ? 'Enabled' : 'Disabled'"
                            :color="enabled ? 'primary' : 'default'" required class="mr-2"
                        />
                        <v-btn v-if="isEditing" icon max-height="50" color="red-lighten-1" @click="openDeleteDialog()">
                            <v-icon>mdi-delete</v-icon>
                        </v-btn>
                    </div>
                </v-card-title>
                <v-card-text class="pt-0">
                    <v-row justify="center">
                        <v-col cols="12" class="pt-0">
                            <v-text-field
                                v-if="!isEditing" v-model="name" label="Schedule Name"
                                :rules="[rules.required]" required :disabled="isEditing"
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
                    <v-row no-gutters justify="center">
                        <v-col cols="12" class="d-flex justify-center">
                            <v-label>Topic</v-label>
                        </v-col>
                        <v-col cols="12">
                            <v-select
                                v-model="topic" :items="props.topics" label="Select Topic" required
                                :rules="[rules.required]"
                            >
                                <template #prepend-inner>
                                    <v-icon>mdi-sitemap-outline</v-icon>
                                </template>
                            </v-select>
                        </v-col>
                    </v-row>

                    <v-row no-gutters class="d-flex justify-center">
                        <v-col cols="12" class="d-flex justify-center">
                            <v-label>Type</v-label>
                        </v-col>
                        <v-col cols="12" class="d-flex justify-center">
                            <v-btn-toggle
                                v-model="scheduleType" label="Schedule Type" mandatory divided
                                variant="elevated" border="sm" rounded="xl"
                            >
                                <v-btn prepend-icon="mdi-clock-outline" value="time">Time</v-btn>
                                <v-btn prepend-icon="mdi-sun-clock" value="solar">Solar</v-btn>
                                <v-btn prepend-icon="mdi-code-brackets" group:selected="cronType()" value="cron">
                                    Cron
                                </v-btn>
                            </v-btn-toggle>
                        </v-col>
                    </v-row>

                    <v-row v-if="scheduleType === 'time'" justify="center" class="mb-5">
                        <v-row no-gutters>
                            <v-col cols="12" class="d-flex justify-center">
                                <v-label>Period</v-label>
                            </v-col>
                            <v-col cols="12" class="mx-auto">
                                <v-btn-toggle
                                    v-model="period" class="d-flex flex-wrap" style="min-height: fit-content"
                                    label="Period" mandatory border="sm" rounded="xl"
                                >
                                    <v-row no-gutters>
                                        <v-col>
                                            <v-btn
                                                prepend-icon="mdi-timer-refresh-outline" value="minutes"
                                                min-width="100%"
                                            >
                                                Minute
                                            </v-btn>
                                        </v-col>
                                        <v-col>
                                            <v-btn prepend-icon="mdi-timer-refresh" value="hourly" min-width="100%">
                                                Hour
                                            </v-btn>
                                        </v-col>
                                        <v-col>
                                            <v-btn prepend-icon="mdi-calendar-range" value="daily" min-width="100%">
                                                Day
                                            </v-btn>
                                        </v-col>
                                    </v-row>
                                    <v-row no-gutters>
                                        <v-col>
                                            <v-btn prepend-icon="mdi-calendar-weekend" value="weekly" min-width="100%">
                                                Week
                                            </v-btn>
                                        </v-col>
                                        <v-col>
                                            <v-btn
                                                prepend-icon="mdi-calendar-month-outline" value="monthly"
                                                min-width="100%"
                                            >
                                                Month
                                            </v-btn>
                                        </v-col>
                                        <v-col>
                                            <v-btn
                                                prepend-icon="mdi-calendar-today-outline" value="yearly"
                                                min-width="100%"
                                            >
                                                Year
                                            </v-btn>
                                        </v-col>
                                    </v-row>
                                </v-btn-toggle>
                            </v-col>
                        </v-row>
                        <v-row justify="center">
                            <v-col v-if="period === 'daily'" cols="12" class="d-flex justify-center">
                                <v-select
                                    v-model="dailyDays" :items="daysOfWeek" label="Select Days" multiple required
                                    :rules="[rules.required]"
                                >
                                    <template #prepend-inner>
                                        <v-icon>mdi-calendar-range</v-icon>
                                    </template>
                                </v-select>
                            </v-col>
                            <v-col v-if="period === 'weekly'" cols="12" class="d-flex justify-center">
                                <v-select
                                    v-model="weeklyDays" :items="daysOfWeek" label="Select Days" multiple required
                                    :rules="[rules.required]"
                                >
                                    <template #prepend-inner>
                                        <v-icon>mdi-calendar-weekend</v-icon>
                                    </template>
                                </v-select>
                            </v-col>
                            <v-col v-if="period === 'monthly'" cols="12" class="d-flex justify-center">
                                <v-select
                                    v-model="monthlyDays" :items="daysOfMonth" label="Select Days" multiple
                                    required :rules="[rules.required]"
                                >
                                    <template #prepend-inner>
                                        <v-icon>mdi-calendar-month-outline</v-icon>
                                    </template>
                                </v-select>
                            </v-col>
                            <v-col v-if="period === 'yearly'" cols="12" class="d-flex justify-center">
                                <v-select
                                    v-model="yearlyMonth" :items="months" label="Select Month" required
                                    :rules="[rules.required]"
                                >
                                    <template #prepend-inner>
                                        <v-icon>mdi-calendar-month-outline</v-icon>
                                    </template>
                                </v-select>
                            </v-col>
                            <v-col v-if="period === 'yearly'" cols="12" class="d-flex justify-center">
                                <v-select
                                    v-model="yearlyDay" :items="daysOfMonth" label="Select Day" required
                                    :rules="[rules.required]"
                                >
                                    <template #prepend-inner>
                                        <v-icon>mdi-calendar-today-outline</v-icon>
                                    </template>
                                </v-select>
                            </v-col>
                            <v-col v-if="period === 'minutes'" cols="12" class="d-flex justify-center">
                                <v-select
                                    v-model="minutesInterval" :items="generateNumberArray(1, 59)"
                                    label="Interval (Minutes)" :rules="[rules.required]"
                                >
                                    <template #prepend-inner>
                                        <v-icon>mdi-repeat</v-icon>
                                    </template>
                                </v-select>
                            </v-col>
                            <v-col v-if="period === 'hourly'" cols="12" class="d-flex justify-center">
                                <v-select
                                    v-model="hourlyInterval" :items="generateNumberArray(1, 23)"
                                    label="Interval (Hours)" :rules="[rules.required]"
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
                                    v-if="props.useNewTimePicker" v-model="formattedTime" :active="modalTime"
                                    :focused="modalTime" readonly :rules="[rules.required]"
                                    :label="hasEndTime ? 'Start Time' : 'Time'"
                                >
                                    <template #prepend-inner>
                                        <v-icon
                                            :color="hasEndTime ? 'green' : undefined"
                                            :icon="hasEndTime ? 'mdi-clock-start' : 'mdi-clock-time-four-outline'"
                                        />
                                    </template>
                                    <v-dialog v-model="modalTime" activator="parent" width="auto">
                                        <v-time-picker
                                            v-if="modalTime" v-model="time"
                                            :max="hasEndTime ? endTime : undefined"
                                            :format="props.use24HourFormat ? '24hr' : 'ampm'"
                                            :ampm-in-title="!props.use24HourFormat"
                                        />
                                    </v-dialog>
                                </v-text-field>
                                <v-text-field
                                    v-else v-model="time" :label="hasEndTime ? 'Start Time' : 'Time'"
                                    type="time" :rules="[rules.required]"
                                >
                                    <template #prepend-inner>
                                        <v-icon
                                            :color="hasEndTime ? 'green' : undefined"
                                            :icon="hasEndTime ? 'mdi-clock-start' : 'mdi-clock-time-four-outline'"
                                        />
                                    </template>
                                </v-text-field>
                            </v-col>
                            <v-col
                                v-if="hasEndTime && period !== 'minutes' && period !== 'hourly'" cols="12"
                                class="d-flex justify-center"
                            >
                                <v-text-field
                                    v-if="props.useNewTimePicker" v-model="formattedEndTime"
                                    :active="modalEndTime" :focused="modalEndTime" label="End Time" readonly
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
                                    v-else v-model="endTime" label="End Time" type="time"
                                    :rules="[rules.required]"
                                >
                                    <template #prepend-inner>
                                        <v-icon color="red" icon="mdi-clock-end" />
                                    </template>
                                </v-text-field>
                            </v-col>
                        </v-row>
                        <v-row v-if="period !== 'minutes' && period !== 'hourly'" justify="center" no-gutters>
                            <v-col cols="12" class="d-flex justify-center">
                                <v-label>Timespan</v-label>
                            </v-col>
                            <v-col cols="12" class="d-flex justify-center">
                                <v-btn-toggle
                                    v-model="hasEndTime" mandatory divided variant="elevated" border="sm"
                                    rounded="xl" @update:model-value="setEndTime"
                                >
                                    <v-btn prepend-icon="mdi-circle-off-outline" :value="false">None</v-btn>
                                    <v-btn prepend-icon="mdi-clock-end" :value="true">End Time</v-btn>
                                </v-btn-toggle>
                            </v-col>
                        </v-row>
                    </v-row>

                    <v-row v-if="scheduleType === 'solar'" no-gutters class="mt-6">
                        <v-col cols="12" class="d-flex justify-center">
                            <v-label>Event</v-label>
                        </v-col>
                        <v-col cols="12" class="d-flex justify-center">
                            <v-select
                                v-model="solarEvent" :items="solarEvents" label="Select Event" required
                                :rules="[rules.required]"
                            >
                                <template #prepend-inner>
                                    <v-icon>mdi-weather-sunset</v-icon>
                                </template>
                            </v-select>
                        </v-col>
                        <v-col cols="12" class="d-flex justify-center">
                            <v-select
                                v-model="offset" :items="offsetItems" label="Offset (minutes)"
                                :rules="[rules.required]"
                            >
                                <template #prepend-inner>
                                    <v-icon>mdi-plus-minus</v-icon>
                                </template>
                            </v-select>
                        </v-col>
                    </v-row>

                    <v-row
                        v-if="((period === 'minutes' || period === 'hourly') || scheduleType === 'solar')"
                        justify="center" no-gutters
                    >
                        <v-col cols="12" class="d-flex justify-center">
                            <v-label>Timespan</v-label>
                        </v-col>
                        <v-col cols="12" class="d-flex justify-center mb-5">
                            <v-btn-toggle
                                v-model="hasDuration" mandatory divided variant="elevated" border="sm"
                                rounded="xl"
                            >
                                <v-btn prepend-icon="mdi-circle-off-outline" :value="false">None</v-btn>
                                <v-btn prepend-icon="mdi-timer-sand-complete" :value="true">Duration</v-btn>
                            </v-btn-toggle>
                        </v-col>
                        <v-col
                            v-if="((period === 'minutes' || period === 'hourly') || scheduleType === 'solar') && hasDuration"
                            cols="12" class="d-flex justify-center"
                        >
                            <v-select
                                v-model="duration" :items="durationItems" label="Duration (minutes)"
                                :rules="[rules.required]"
                            >
                                <template #prepend-inner>
                                    <v-icon>mdi-timer-sand-complete</v-icon>
                                </template>
                            </v-select>
                        </v-col>
                    </v-row>

                    <v-row v-if="scheduleType === 'cron'" justify="center" no-gutters class="my-6">
                        <v-col cols="12" class="d-flex justify-center">
                            <v-label>Description</v-label>
                        </v-col>
                        <v-col cols="12" class="d-flex justify-center">
                            <v-textarea
                                v-if="!cronLoading" v-model="cronDescription" readonly rows="2" auto-grow
                                variant="solo" class="centered-input"
                            />
                            <v-progress-linear v-else indeterminate />
                        </v-col>
                        <v-col v-if="cronNextDates" cols="12" class="d-flex justify-center">
                            <v-expansion-panels class="my-4" variant="popout">
                                <v-expansion-panel title="Next Info">
                                    <v-expansion-panel-text>
                                        <v-list>
                                            <v-list-subheader class="centered-subheader">Next Dates</v-list-subheader>
                                            <v-list-item
                                                v-for="(date, index) in cronNextDates" :key="index"
                                                class="px-auto"
                                            >
                                                {{ date }}
                                            </v-list-item>
                                            <v-list-subheader class="centered-subheader">Next Time</v-list-subheader>
                                            <v-list-item class="px-auto">{{ cronNextTime }}</v-list-item>
                                        </v-list>
                                    </v-expansion-panel-text>
                                </v-expansion-panel>
                                <v-expansion-panel title="Cron Info">
                                    <v-expansion-panel-text>
                                        <CronFieldsTable class="mb-4" />
                                        <v-divider />
                                        <CronSpecialCharacters />
                                    </v-expansion-panel-text>
                                </v-expansion-panel>
                            </v-expansion-panels>
                        </v-col>
                        <v-col cols="12" class="d-flex justify-center mt-3">
                            <v-label>Expression</v-label>
                        </v-col>
                        <v-col cols="11" class="d-flex justify-center">
                            <v-text-field
                                :model-value="cronValue" style="letter-spacing: 2px;"
                                @update:model-value="getCronDescription" @blur="cronValue = nextCronValue"
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
                                v-model="cronValue" :fields="fields" :chipProps="{ color: 'primary' }"
                                format="quartz"
                            />
                        </v-col>
                    </v-row>

                    <v-row justify="center" no-gutters>
                        <v-col cols="12" class="d-flex justify-center">
                            <v-label>Output</v-label>
                        </v-col>
                        <v-col cols="12" class="d-flex justify-center">
                            <v-btn-toggle
                                v-model="payloadType" mandatory divided variant="elevated" border="sm" rounded="xl"
                            >
                                <v-btn v-if="!isTimespanSchedule" prepend-icon="mdi-close-circle-outline" :value="false" color="red">False</v-btn>
                                <v-btn v-if="!isTimespanSchedule" prepend-icon="mdi-check-circle-outline" :value="true" color="green">True</v-btn>
                                <v-btn v-if="isTimespanSchedule" prepend-icon="mdi-check-circle-outline" :value="'true_false'" color="green">True/False</v-btn>
                                <v-btn prepend-icon="mdi-code-braces" :value="'custom'" color="blue">Custom</v-btn>
                            </v-btn-toggle>
                        </v-col>
                        <v-col v-if="payloadType === 'custom'" cols="12" class="d-flex justify-center mt-3">
                            <v-select
                                v-model="customPayloadStart"
                                :items="customPayloads"
                                :item-title="getCustomPayloadTitle"
                                item-value="id"
                                :label="isTimespanSchedule ? 'Custom Output: Start' : 'Custom Output'"
                                no-data-text="No custom payloads defined"
                            />
                        </v-col>
                        <v-col v-if="payloadType === 'custom' && isTimespanSchedule" cols="12" class="d-flex justify-center">
                            <v-select
                                v-model="customPayloadEnd"
                                :items="customPayloads"
                                :item-title="getCustomPayloadTitle"
                                item-value="id"
                                label="Custom Output: End"
                                no-data-text="No custom payloads defined"
                            />
                        </v-col>
                    </v-row>
                </v-card-text>
                <v-card-actions class="d-flex justify-center mb-5">
                    <v-btn variant="outlined" color="green" @click="saveSchedule">Save</v-btn>
                    <v-btn variant="outlined" color="red" @click="closeDialog">Cancel</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
        <v-dialog
            v-model="dialogDelete" min-width="fit-content" scrim="red-darken-4" color="background"
            max-width="500px"
        >
            <v-card>
                <v-card-title class="text-body-2 text-center">
                    Are you sure you want to delete this schedule?
                </v-card-title>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="outlined" color="error" @click="deleteConfirm">Delete</v-btn>
                    <v-btn variant="outlined" @click="closeDelete">Cancel</v-btn>
                    <v-spacer />
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-container>
</template>

<script setup>
// eslint-disable-next-line no-unused-vars
import { defaultItems, pad } from '@vue-js-cron/core'
import { useDisplay } from 'vuetify'
</script>
<script>
import { mapState } from 'vuex'

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
        const fieldItems = defaultItems('en')
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

            // Scheduling options
            name: null,
            enabled: false,
            topic: null,
            scheduleType: null,
            period: null,
            time: null,
            endTime: null,
            hasEndTime: false,
            hasDuration: false,
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
            payloadType: true,
            payloadValue: true,
            customPayloadStart: null,
            customPayloadEnd: null,

            // Modal controls
            modalTime: false,
            modalEndTime: false,
            dialog: false,
            dialogDelete: false,

            // Datatable
            expanded: [],
            expandedItem: null,
            updatingExpanded: false, // Flag to control updates
            headers: [
                { title: 'Name', align: 'start', key: 'name' },
                { title: 'Description', align: 'start', key: 'description' },
                { title: 'Enabled', align: 'center', key: 'action' }
            ],

            // Date and time arrays
            months: [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ],
            daysOfWeek: [
                'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
                'Saturday', 'Sunday'
            ],

            // Solar events
            solarEvents: [
                { title: 'Night End', value: 'nightEnd' },
                { title: 'Nautical Dawn', value: 'nauticalDawn' },
                { title: 'Civil Dawn', value: 'civilDawn' },
                { title: 'Sunrise', value: 'sunrise' },
                { title: 'Sunrise End', value: 'sunriseEnd' },
                { title: 'Morning Golden Hour End', value: 'morningGoldenHourEnd' },
                { title: 'Solar Noon', value: 'solarNoon' },
                { title: 'Evening Golden Hour Start', value: 'eveningGoldenHourStart' },
                { title: 'Sunset Start', value: 'sunsetStart' },
                { title: 'Sunset', value: 'sunset' },
                { title: 'Civil Dusk', value: 'civilDusk' },
                { title: 'Nautical Dusk', value: 'nauticalDusk' },
                { title: 'Night Start', value: 'nightStart' },
                { title: 'Nadir', value: 'nadir' }
            ],

            // Validation rules
            rules: {
                required: value => !!value || 'Required.',
                endTimeRule: value => this.endTime > this.time || 'End time must be after start time'
            },

            // cron expression
            cronValue: '*/5 * * * *',
            nextCronValue: '',
            error: '',
            fields: [
                { id: 'second', items: fieldItems.secondItems },
                { id: 'minute', items: fieldItems.minuteItems },
                { id: 'hour', items: fieldItems.hourItems },
                { id: 'day', items: fieldItems.dayItems },
                { id: 'month', items: fieldItems.monthItems },
                { id: 'dayOfWeek', items: fieldItems.dayOfWeekItems }
            ],
            cronDescription: 'Every 5 minutes',
            cronExpValid: true,
            cronLoading: false,
            cronNextDates: null,
            cronNextTime: null
        }
    },

    computed: {
        ...mapState('data', ['messages']),
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
        uniqueTopics () {
            if (this.schedules && Array.isArray(this.schedules)) {
                const topics = this.schedules.map((schedule2) => schedule2.topic)
                return [...new Set(topics)]
            } else {
                return [] // Or handle the case where schedules are undefined
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
            return (this.scheduleType === 'time' && (this.period === 'daily' || this.period === 'weekly' || this.period === 'monthly' || this.period === 'yearly') && this.hasEndTime) ||
                (((this.scheduleType === 'time' && (this.period === 'minutes' || this.period === 'hourly')) || this.scheduleType === 'solar') && this.hasDuration)
        },
        customPayloads () {
            return this.props.customPayloads || []
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
                this.yearlyDay = null // Reset if the selected day is no longer valid
            }
        },
        hasDuration (value) {
            if (this.period === 'minutes') {
                if (!this.durationItems.includes((this.minutesInterval ?? 0) - 1)) {
                    this.duration = null
                    this.hasDuration = false
                }
            }
            if (((this.scheduleType === 'time' && ['minutes', 'hours'].includes(this.period)) || this.scheduleType === 'solar')) {
                if (value === true) {
                    if (this.payloadType !== 'custom') {
                        this.payloadType = 'true_false'
                    }
                } else {
                    if (this.payloadType !== 'custom') {
                        this.payloadType = false
                    }
                }
            }
        },
        hasEndTime (value) {
            if (this.scheduleType === 'time' && ['daily', 'weekly', 'monthly', 'yearly'].includes(this.period)) {
                if (value === true) {
                    if (this.payloadType !== 'custom') {
                        this.payloadType = 'true_false'
                    }
                } else {
                    if (this.payloadType !== 'custom') {
                        this.payloadType = false
                    }
                }
            }
        },
        minutesInterval (value) {
            if (this.period === 'minutes') {
                if (!this.durationItems.includes(value - 1)) {
                    this.duration = null
                    this.hasDuration = false
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
                if (msg.payload !== undefined) {
                    this.updateDynamicProperty('schedules', msg.payload?.schedules || [])
                }
            }
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
        },
        onDynamicProperties (msg) {
            const updates = msg.ui_update
            if (!updates) {
                return
            }
            this.updateDynamicProperty('schedules', updates.schedules)
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
        getMaxDaysInMonth (monthName) {
            const month = this.months.indexOf(monthName) + 1
            if (month === 0) {
                return 0
            }
            return month === 2 ? 29 : new Date(2024, month, 0).getDate()
        },
        isNameDuplicate () {
            return this.schedules
                ? this.schedules.some(
                    schedule =>
                        schedule.name === this.name && schedule !== this.currentSchedule && !this.isEditing
                )
                : false
        },

        getCustomPayloadTitle (item) {
            if (!item) return ''
            // Use item.value for the title if item.label is an empty string or null
            let title = item.label ? item.label : (item.type === 'json' ? JSON.stringify(item.value) : item.value)
            if (!title) return ''
            // Truncate the title if it exceeds 30 characters
            if (title.length > 30) {
                title = title.slice(0, 30) + '...'
            }
            return title
        },

        mapSolarEvent (event, toTitle = true) {
            const found = this.solarEvents.find(e => toTitle ? e.value === event : e.title === event)
            return found ? (toTitle ? found.title : found.value) : event
        },
        sendSchedule (schedule) {
            const msg = { action: 'submit', payload: { schedules: [schedule] } }
            this.$socket.emit('widget-action', this.id, msg)
        },
        getCronDescription (expression) {
            this.nextCronValue = expression
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
            const { nextEndUTC, currentStartTime } = item

            // Ensure the dates are converted into timestamps
            const nextEndMillis = new Date(nextEndUTC).getTime()
            const currentStartMillis = new Date(currentStartTime).getTime()

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
                    newSchedule.hasEndTime = this.hasEndTime
                    newSchedule.endTime = this.hasEndTime ? this.endTime : null
                }

                if (this.period === 'yearly') {
                    newSchedule.month = this.yearlyMonth
                }

                if (this.period === 'minutes') {
                    newSchedule.minutesInterval = this.minutesInterval
                    newSchedule.hasDuration = this.hasDuration
                    newSchedule.duration = this.duration
                }

                if (this.period === 'hourly') {
                    newSchedule.hourlyInterval = this.hourlyInterval
                    newSchedule.hasDuration = this.hasDuration
                    newSchedule.duration = this.duration
                }
            }

            if (this.scheduleType === 'solar') {
                newSchedule.solarEvent = this.mapSolarEvent(this.solarEvent, false)
                newSchedule.offset = this.offset

                if (this.hasDuration) {
                    newSchedule.hasDuration = this.hasDuration
                    newSchedule.duration = this.duration
                }
            }

            if (this.scheduleType === 'cron') {
                newSchedule.startCronExpression = this.cronValue
                if (this.hasDuration) {
                    newSchedule.hasDuration = this.hasDuration
                    newSchedule.duration = this.duration
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
                Object.assign(this.currentSchedule, newSchedule)
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
                return { alert: true, message: 'Schedule Name is required.' }
            }

            if (this.isNameDuplicate()) {
                return { alert: true, message: 'Schedule Name must be unique.' }
            }

            if (!this.topic) {
                return { alert: true, message: 'Topic is required.' }
            }

            if (this.scheduleType === 'time') {
                if (!this.period) {
                    return { alert: true, message: 'Period is required.' }
                }
                if (['daily', 'weekly', 'monthly', 'yearly'].includes(this.period)) {
                    if (!this.time) {
                        return { alert: true, message: 'Start Time is required.' }
                    }
                    if (this.hasEndTime) {
                        if (!this.endTime) {
                            return {
                                alert: true,
                                message: 'End Time is required.'
                            }
                        }
                        if (this.endTime <= this.time) {
                            return {
                                alert: true,
                                message: 'End Time must be after Start Time.'
                            }
                        }
                    }
                    const days = this.getSelectedDays()
                    if (!days.length) {
                        return {
                            alert: true,
                            message: `At least one day must be selected for ${this.period} period.`
                        }
                    }
                } else if (this.period === 'minutes') {
                    if (!this.minutesInterval) {
                        return { alert: true, message: 'Interval is required for Minutes period.' }
                    }
                    if (this.hasDuration && !this.duration) {
                        return {
                            alert: true,
                            message: 'Duration is required when Duration is enabled for Minutes period.'
                        }
                    }
                } else if (this.period === 'hourly') {
                    if (!this.hourlyInterval) {
                        return { alert: true, message: 'Interval is required for Hourly period.' }
                    }
                    if (this.hasDuration && !this.duration) {
                        return {
                            alert: true,
                            message: 'Duration is required when Duration is enabled for Hourly period.'
                        }
                    }
                }
            } else if (this.scheduleType === 'solar') {
                if (!this.props.defaultLocation || this.defaultLocation === '') {
                    return { alert: true, message: 'Solar Event requires a location to be configured in editor settings.' }
                }
                if (!this.solarEvent) {
                    return { alert: true, message: 'Solar Event is required.' }
                }
                if (!this.offset && this.offset !== 0) {
                    return { alert: true, message: 'Offset is required for Solar schedule type.' }
                }
                if (this.hasDuration && !this.duration) {
                    return {
                        alert: true,
                        message: 'Duration is required when Duration is enabled for Solar schedule type.'
                    }
                }
            } else if (this.scheduleType === 'cron') {
                if (!this.cronValue || !this.cronExpValid) {
                    return { alert: true, message: 'A valid cron expression is required.' }
                }
            }

            if (this.payloadType === null) {
                return {
                    alert: true,
                    message: 'Output value is required.'
                }
            }

            if (this.payloadType === 'custom') {
                if (this.customPayloadStart === null) {
                    return {
                        alert: true,
                        message: 'Custom output value is required.'
                    }
                }
                if (this.customPayloadEnd === null && this.isTimespanSchedule) {
                    return {
                        alert: true,
                        message: 'Custom output value is required.'
                    }
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
        toggleSchedule (item) {
            const enabled = !item.enabled
            if (item.name) {
                this.$socket.emit('widget-action', this.id, {
                    action: 'setEnabled',
                    payload: { name: item.name, enabled },
                    topic: item.topics
                })
            }
        },
        toggleAllSchedules () {
            const enabled = !this.anyScheduleEnabled
            const names = this.filteredSchedules.map(schedule => schedule.name).filter(name => name)

            if (names.length > 0) {
                this.$socket.emit('widget-action', this.id, {
                    action: 'setEnabled',
                    payload: { names, enabled, all: true },
                    topic: this.selectedTopic
                })
            }
        },

        requestStatus (item) {
            if (item.name) {
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
            this.hasDuration = item.hasDuration !== undefined ? item.hasDuration : this.hasDuration
            this.duration = item.duration || this.duration
            this.hourlyInterval = item.hourlyInterval || this.hourlyInterval

            this.yearlyMonth = item.month || this.yearlyMonth
            this.hasEndTime = item.hasEndTime !== undefined ? item.hasEndTime : this.hasEndTime
            this.endTime = item.endTime || this.endTime
            this.solarEvent = this.mapSolarEvent(item.solarEvent) || this.solarEvent
            this.offset = item.offset || this.offset
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
            const baseName = 'Schedule'
            let newName = baseName
            let index = 2

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
            this.scheduleType = 'time'
            this.period = 'daily'
            this.dailyDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            this.weeklyDays = ['Monday']
            this.monthlyDays = [1]
            this.yearlyDay = 1
            this.yearlyMonth = 'January'
            this.time = '00:00'
            this.hasEndTime = false
            this.endTime = '00:05'
            this.minutesInterval = 10
            this.hourlyInterval = 1
            this.solarEvent = 'Sunrise'
            this.offset = 0
            this.cronValue = '*/5 * * * *'
            this.hasDuration = false
            this.duration = 1
            this.payloadValue = true
            this.payloadType = true
            this.customPayloadStart = null
            this.customPayloadEnd = null
        },
        setEndTime () {
            if (!this.hasEndTime) {
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
                const index = this.schedules.findIndex(schedule => schedule.name === this.currentSchedule.name)
                if (index > -1) {
                    this.schedules.splice(index, 1)
                    this.$socket.emit('widget-action', this.id, {
                        action: 'remove',
                        payload: { name: this.currentSchedule.name }
                    })
                }
                this.closeDialog()
            }
            this.dialogDelete = false
        }
    }
}
</script>

<style>
@import "../stylesheets/ui-scheduler.css";
</style>
