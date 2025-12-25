const version = '3.3.5'
const packageName = '@cgjgh/node-red-dashboard-2-ui-scheduler'

/* eslint-disable no-unused-vars */
/* eslint-disable no-case-declarations */
/* eslint-disable no-console */

const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')

const { TZDate } = require('@date-fns/tz')
const coordParser = require('coord-parser')
const cronosjs = require('cronosjs-extended')
const cronstrue = require('cronstrue/i18n')
const { addMinutes, addHours, startOfYear } = require('date-fns')

const { createMs } = require('enhanced-ms')
const analytics = require('node-debug-analytics')
const semver = require('semver')

const SunCalc = require('suncalc2')

SunCalc.addTime(-18, 'nightEnd', 'nightStart')
SunCalc.addTime(-6, 'civilDawn', 'civilDusk')
SunCalc.addTime(6, 'morningGoldenHourEnd', 'eveningGoldenHourStart')

const availableLocales = ['en', 'de', 'fr', 'it', 'nl', 'es', 'pl', 'cs', 'zh-CN']

/**
 * Sets the locale for the given configuration object.
 *
 * If the current locale in the configuration is null or not in the list of
 * available locales, it attempts to set the locale to the provided settingsLang
 * if it is valid. Defaults to 'en' if no valid locale is found.
 *
 * @param {Object} config - The configuration object containing the locale setting.
 * @param {string} settingsLang - The preferred language setting to be applied.
 * @returns {string} - The finalized locale setting.
 */
function setLocale (config, settingsLang) {
    if (config.locale === null || !availableLocales.includes(config.locale)) {
        config.locale = (settingsLang && availableLocales.includes(settingsLang))
            ? settingsLang
            : 'en'
    }
    return config.locale
}

// globally accesible milliseconds formatter
let enhancedMs
function initializeMs (language) {
    enhancedMs = createMs({ language })
}

// Solar events
const solarEvents = [
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
]

const PERMITTED_SOLAR_EVENTS = solarEvents.map(event => event.value)

const daysOfWeek = [
    { title: 'Sunday', value: 'sunday', short: 'Sun' },
    { title: 'Monday', value: 'monday', short: 'Mon' },
    { title: 'Tuesday', value: 'tuesday', short: 'Tue' },
    { title: 'Wednesday', value: 'wednesday', short: 'Wed' },
    { title: 'Thursday', value: 'thursday', short: 'Thu' },
    { title: 'Friday', value: 'friday', short: 'Fri' },
    { title: 'Saturday', value: 'saturday', short: 'Sat' }
]

const allDaysOfWeek = daysOfWeek.map(day => day.value)

const months = [
    { title: 'January', value: 'january' },
    { title: 'February', value: 'february' },
    { title: 'March', value: 'march' },
    { title: 'April', value: 'april' },
    { title: 'May', value: 'may' },
    { title: 'June', value: 'june' },
    { title: 'July', value: 'july' },
    { title: 'August', value: 'august' },
    { title: 'September', value: 'september' },
    { title: 'October', value: 'october' },
    { title: 'November', value: 'november' },
    { title: 'December', value: 'december' }
]

const allMonths = months.map(month => month.value)

function getMaxDaysInMonth (monthName) {
    const month = months.indexOf(monthName) + 1
    if (month === 0) {
        return 0
    }
    return month === 2 ? 29 : new Date(2024, month, 0).getDate()
}

/**
 * Abbreviates the day names in a given description string.
 *
 * This function replaces full day names (e.g., "Monday") in the input
 * description with their corresponding short forms (e.g., "Mon") using
 * a predefined mapping of days of the week.
 *
 * @param {string} description - The input string containing full day names.
 * @returns {string} - The modified string with abbreviated day names.
 */
const abbreviateDays = (description) => {
    if (!description) return ''

    // Create a mapping from title to short
    const dayMapping = daysOfWeek.reduce((acc, day) => {
        acc[day.title.toLowerCase()] = day.short // Store lowercase keys
        return acc
    }, {})

    return description.replace(
        new RegExp(`\\b(${daysOfWeek.map(day => day.title).join('|')})\\b`, 'gi'), // Add 'i' flag for case-insensitivity
        (day) => dayMapping[day.toLowerCase()] || day // Normalize day to lowercase
    )
}

// localized strings
let futureTemplate = 'in {time}'
let pastTemplate = '{time} ago'
let never = 'Never'
let lessThanASecond = 'Less than a second'

/**
 * Converts a given time in milliseconds to a human-readable format indicating
 * how long ago the time was. If the input is not provided, defaults to 0.
 * Utilizes the `enhancedMs` function to format the milliseconds and replaces
 * any negative signs with an empty string. The formatted time is then inserted
 * into the `pastTemplate` string.
 *
 * @param {number} ms - The time in milliseconds to be converted.
 * @returns {string} A string representing the time in a human-readable format.
 */
function pastMs (ms) {
    if (!ms) ms = 0
    let formatted
    if (ms < 1000) {
        formatted = lessThanASecond
    } else {
        // Otherwise, format normally
        formatted = enhancedMs(ms)
    }

    if (formatted && formatted.indexOf('-') >= 0) {
        formatted = formatted.replace(/-/g, '')
    }

    return pastTemplate.replace('{time}', formatted)
}

/**
 * Generates a future time string by replacing the placeholder in the futureTemplate
 * with the enhanced milliseconds value.
 *
 * @param {number} ms - The number of milliseconds to be enhanced and formatted.
 * @returns {string} A formatted string indicating the future time.
 */
function futureMs (ms) {
    if (!ms) ms = 0
    let formatted
    if (ms < 1000) {
        formatted = lessThanASecond
    } else {
        // Otherwise, format normally
        formatted = enhancedMs(ms)
    }

    if (formatted && formatted.indexOf('-') >= 0) {
        formatted = formatted.replace(/-/g, '')
    }

    return futureTemplate.replace('{time}', formatted)
}

// accepted commands using topic as the command & (in compatible cases, the payload is the schedule name)
// commands not supported by topic are : add/update & describe
const controlTopics = [
    { command: 'trigger', payloadIsName: true },
    { command: 'status', payloadIsName: true },
    { command: 'list', payloadIsName: true },
    { command: 'export', payloadIsName: true },
    { command: 'stop', payloadIsName: true },
    { command: 'stop-all', payloadIsName: false },
    { command: 'stop-topic', payloadIsName: false },
    { command: 'stop-all-dynamic', payloadIsName: false },
    { command: 'stop-all-static', payloadIsName: false },
    { command: 'pause', payloadIsName: true },
    { command: 'pause-all', payloadIsName: false },
    { command: 'pause-topic', payloadIsName: false },
    { command: 'pause-all-dynamic', payloadIsName: false },
    { command: 'pause-all-static', payloadIsName: false },
    { command: 'start', payloadIsName: true },
    { command: 'start-all', payloadIsName: false },
    { command: 'start-topic', payloadIsName: false },
    { command: 'start-all-dynamic', payloadIsName: false },
    { command: 'start-all-static', payloadIsName: false },
    { command: 'clear', payloadIsName: false },
    { command: 'remove', payloadIsName: true },
    { command: 'delete', payloadIsName: true },
    { command: 'debug', payloadIsName: true },
    { command: 'next', payloadIsName: false }
]
const addExtendedControlTopics = function (baseCommand) {
    controlTopics.push({ command: `${baseCommand}-all`, payloadIsName: false })
    controlTopics.push({ command: `${baseCommand}-topic`, payloadIsName: false })
    controlTopics.push({ command: `${baseCommand}-all-dynamic`, payloadIsName: false })
    controlTopics.push({ command: `${baseCommand}-all-static`, payloadIsName: false })
    controlTopics.push({ command: `${baseCommand}-active`, payloadIsName: false })
    controlTopics.push({ command: `${baseCommand}-active-dynamic`, payloadIsName: false })
    controlTopics.push({ command: `${baseCommand}-active-static`, payloadIsName: false })
    controlTopics.push({ command: `${baseCommand}-inactive`, payloadIsName: false })
    controlTopics.push({ command: `${baseCommand}-inactive-dynamic`, payloadIsName: false })
    controlTopics.push({ command: `${baseCommand}-inactive-static`, payloadIsName: false })
}
addExtendedControlTopics('trigger')
addExtendedControlTopics('status')
addExtendedControlTopics('export')
addExtendedControlTopics('list')
addExtendedControlTopics('remove')
addExtendedControlTopics('delete')
addExtendedControlTopics('debug')

/**
 * Checks for updates of a specified npm package by comparing the current version
 * with the latest version available on the npm registry.
 * The reason for this is to push updates to the user ASAP while were still in beta.
 *
 * @param {string} currentVersion - The current version of the package.
 * @param {string} packageName - The name of the package to check for updates.
 * @param {function} callback - A callback function that receives an object containing
 *                              the update status, current version, and latest version.
 */
function checkForUpdate (currentVersion, packageName, callback) {
    exec(`npm view ${packageName} version`, (error, stdout) => {
        if (error) {
            console.error('Error fetching version:', error)
            callback(null)
            return
        }

        const latestVersion = stdout.trim()

        const isUpdateAvailable = semver.lt(currentVersion, latestVersion)

        callback({
            isUpdateAvailable,
            currentVersion,
            latestVersion
        })
    })
}

/**
 * Applies localized names to solar events by updating their titles.
 *
 * This function iterates over the predefined list of solar events and attempts
 * to retrieve a localized title for each event using the provided RED object.
 * If a localized title is found, it updates the event's title with the localized
 * version. The localization keys are constructed using the event's value.
 *
 * @param {Object} RED - The RED object used for retrieving localized strings.
 */
function applyLocalizedSolarEventNames (RED) {
    solarEvents.forEach(event => {
        // Get the localized title string for this event value.
        const localizedTitle = RED._('ui-scheduler.solarEvents.' + event.value)
        // Only update if a localized title is found (i.e. it isn't null or falsy)
        if (localizedTitle) {
            event.title = localizedTitle
        }
    })
}

/**
 * Localizes the day names and their abbreviations in the `daysOfWeek` array.
 *
 * This function iterates over each day in the `daysOfWeek` array and updates
 * the `title` and `short` properties with their localized equivalents using
 * the provided `RED` object. If a localized short form is not available, it
 * defaults to the first three letters of the localized title.
 *
 * @param {Object} RED - The localization object used to retrieve localized strings.
 */
function applyLocalizedDayNames (RED) {
    daysOfWeek.forEach(day => {
        // Get the localized title for this day.
        const localizedTitle = RED._('ui-scheduler.days.' + day.value)
        if (localizedTitle) {
            day.title = localizedTitle
        }

        // Get the localized short value for this day.
        const localizedShort = RED._('ui-scheduler.days.' + day.value + '.short')
        if (localizedShort && localizedShort !== 'ui-scheduler.days.' + day.value + '.short') {
            day.short = localizedShort
        } else {
            // Fall back to a three-letter abbreviation from the current title.
            day.short = day.title.substring(0, 3)
        }
    })
}

/**
 * Localizes the text templates for future, past, and never time references
 * using the RED internationalization function. Updates the global variables
 * `futureTemplate`, `pastTemplate`, and `never` with localized strings.
 *
 * @param {Object} RED - The RED object providing internationalization support.
 */
function applyLocalizedWords (RED) {
    futureTemplate = RED._('ui-scheduler.label.future')
    pastTemplate = RED._('ui-scheduler.label.past')
    never = RED._('ui-scheduler.label.never')
    lessThanASecond = RED._('ui-scheduler.label.lessThanASecond')
}

/**
 * Retrieves the title of a solar event based on the provided event key.
 *
 * @param {string} eventKey - The key representing the solar event.
 * @returns {string} The title of the solar event if found, otherwise an empty string.
 */
function getSolarEventName (eventKey) {
    const eventObj = solarEvents.find(e => e.value === eventKey)
    return eventObj ? eventObj.title : ''
}

/**
 * Retrieves the title of a day given its key.
 *
 * @param {string} dayKey - The key representing the day of the week.
 * @returns {string} The title of the day if found, otherwise an empty string.
 */
function getDayName (dayKey) {
    const dayObj = daysOfWeek.find(d => d.value === dayKey)
    return dayObj ? dayObj.title : ''
}

function getDayAbbreviation (dayKey) {
    const dayObj = daysOfWeek.find(d => d.value === dayKey)
    return dayObj ? dayObj.short : ''
}

/**
 * Humanize a cron express
 * @param {string} expression the CRON expression to humanize
 * @returns {string}
 * A human readable version of the expression
 */
const humanizeCron = function (expression, locale, use24HourFormat = true) {
    try {
        const opt = { use24HourTimeFormat: use24HourFormat }
        if (locale) opt.locale = locale
        return cronstrue.toString(expression, opt)
    } catch (error) {
        return `Cannot parse expression '${expression}'`
    }
}

/**
 * Maps a solar event identifier to its corresponding title or vice versa.
 *
 * @param {string} event - The solar event identifier or title to map.
 * @param {boolean} [toTitle=true] - Determines the mapping direction. If true, maps from identifier to title;
 *                                   if false, maps from title to identifier.
 * @returns {string} - The mapped solar event title or identifier. Returns the input if no match is found.
 */
function mapSolarEvent (event, toTitle = true) {
    const found = solarEvents.find(e => toTitle ? e.value === event : e.title === event)
    return found ? (toTitle ? found.title : found.value) : event
}

/**
 * Validate a schedule options. Returns true if OK otherwise throws an appropriate error
 * @param {object} opt the options object to validate
 * @param {boolean} permitDefaults allow certain items to be a default (missing value)
 * @returns {boolean}
 */
function validateOpt (opt, permitDefaults = true) {
    if (!opt) {
        throw new Error('Schedule options are undefined')
    }
    if (!opt.id) {
        throw new Error('Schedule id property missing')
    }
    if (!opt.expressionType || opt.expressionType === 'cron' || opt.expressionType === 'dates') { // cron
        if (!opt.expression) {
            throw new Error(`Schedule '${opt.name}' - expression property missing`)
        }
        let valid = false
        try {
            valid = cronosjs.validate(opt.expression)
            if (valid) { opt.expressionType = 'cron' }
        } catch (error) {
            console.debug(error)
        }
        try {
            if (!valid) {
                valid = isDateSequence(opt.expression)
                if (valid) { opt.expressionType = 'dates' }
            }
        } catch (error) {
            console.debug(error)
        }

        if (!valid) {
            throw new Error(`Schedule '${opt.name}' - expression '${opt.expression}' must be either a cron expression, a date, an a array of dates or a CSV of dates`)
        }
    } else if (opt.expressionType === 'solar') {
        if (!opt.offset) {
            opt.offset = 0
        }
        if (opt.locationType === 'fixed' || opt.locationType === 'env') {
            // location comes from node
        } else {
            if (!opt.location) {
                throw new Error(`Schedule '${opt.name}' - location property missing`)
            }
        }
        if (opt.solarType !== 'selected' && opt.solarType !== 'all') {
            throw new Error(`Schedule '${opt.name}' - solarType property invalid or mising. Must be either "all" or "selected"`)
        }
        if (opt.solarType === 'selected') {
            if (!opt.solarEvents) {
                throw new Error(`Schedule '${opt.name}' - solarEvents property missing`)
            }

            let solarEvents
            if (typeof opt.solarEvents === 'string') {
                solarEvents = opt.solarEvents.split(',')
            } else if (Array.isArray(opt.solarEvents)) {
                solarEvents = opt.solarEvents
            } else {
                throw new Error(`Schedule '${opt.name}' - solarEvents property is invalid`)
            }
            if (!solarEvents.length) {
                throw new Error(`Schedule '${opt.name}' - solarEvents property is empty`)
            }
            for (let index = 0; index < solarEvents.length; index++) {
                const element = solarEvents[index].trim()
                if (!PERMITTED_SOLAR_EVENTS.includes(element)) {
                    throw new Error(`Schedule '${opt.name}' - solarEvents entry '${element}' is invalid`)
                }
            }
        }
    } else {
        throw new Error(`Schedule '${opt.name}' - invalid schedule type '${opt.expressionType}'. Expected expressionType to be 'cron', 'dates' or 'solar'`)
    }
    if (permitDefaults) {
        opt.payload = ((opt.payload === null || opt.payload === '') && opt.payloadType === 'num') ? 0 : opt.payload
        opt.payload = ((opt.payload === null || opt.payload === '') && opt.payloadType === 'str') ? '' : opt.payload
        opt.payload = ((opt.payload === null || opt.payload === '') && opt.payloadType === 'bool') ? false : opt.payload
    }
    if (!opt.payloadType === 'default' && opt.payload === null) {
        throw new Error(`Schedule '${opt.name}' - payload property missing`)
    }
    const okTypes = ['default', 'flow', 'global', 'str', 'num', 'bool', 'json', 'jsonata', 'bin', 'date', 'env', 'custom']
    // eslint-disable-next-line eqeqeq
    const typeOK = okTypes.find(el => { return el == opt.payloadType })
    if (!typeOK) {
        throw new Error(`Schedule '${opt.name}' - type property '${opt.payloadType}' is not valid. Must be one of the following... ${okTypes.join(',')}`)
    }
    return true
}

/**
 * Tests if a string or array of date like items are a date or date sequence
 * @param {String|Array} data An array of date like entries or a CSV string of dates
 */
function isDateSequence (data) {
    try {
        const ds = parseDateSequence(data)
        return (ds && ds.isDateSequence)
        // eslint-disable-next-line no-empty
    } catch (error) { }
    return false
}

/**
 * Adjusts the time of a given Date object to match a specified timezone,
 * considering daylight saving time transitions, and returns the updated Date object.
 *
 * @param {Date} inputDateTime - The original Date object to be adjusted.
 * @param {string} timezone - The IANA timezone identifier to adjust the time to.
 * @param {Array<number>} timeArray - An array containing the hour, minute, and second to set.
 * @returns {TZDate} - The adjusted Date object with the time set according to the specified timezone.
 */
function setTimeForTZ (inputDateTime, timezone, timeArray) {
    const inputHour = timeArray[0] || 0
    const inputMinute = timeArray[1] || 0
    const inputSecond = timeArray[2] || 0

    // Create a TZDate instance in the given timezone
    const tzDate = new TZDate(
        inputDateTime.getFullYear(),
        inputDateTime.getMonth(),
        inputDateTime.getDate(),
        inputHour,
        inputMinute,
        inputSecond,
        timezone
    )

    return tzDate
}

function getCurrentTimezone (node) {
    let tz = node.timeZone
    let localTZ = ''
    if (!tz) {
        try {
            localTZ = Intl.DateTimeFormat().resolvedOptions().timeZone
            tz = localTZ
        } catch (error) { return 'UTC' }
    }
    return tz
}

/**
 * Returns an object describing the parameters.
 * @param {string} expression The expressions or coordinates to use
 * @param {string} expressionType The expression type ("cron" | "solar" | "dates")
 * @param {string} timeZone An optional timezone to use
 * @param {number} offset An optional offset to apply
 * @param {string} solarType Specifies either "all" or "selected" - related to solarEvents property
 * @param {string} solarEvents a CSV of solar events to be included
 * @param {date} time Optional time to use (defaults to Date.now() if excluded)
 */
function _describeExpression (expression, expressionType, timeZone, offset, solarType, solarEvents, time, opts, use24HourFormat = true, locale = null) {
    const now = time ? new Date(time) : new Date()
    opts = opts || {}
    let result = { description: undefined, nextDate: undefined, nextDescription: undefined, prettyNext: 'Never' }
    const cronOpts = timeZone ? { timezone: timeZone } : undefined
    let ds = null
    let dsOk = false
    let exOk = false
    // let now = new Date();

    if (solarType === 'all') {
        solarEvents = PERMITTED_SOLAR_EVENTS.join(',')
    }

    if (expressionType === 'solar') {
        const opt = {
            locationType: opts.locationType || opts.defaultLocationType,
            defaultLocationType: opts.defaultLocationType,
            defaultLocation: opts.defaultLocation,
            expressionType,
            location: expression,
            offset: offset || 0,
            name: 'dummy',
            id: 'dummy',
            solarType,
            solarEvents,
            solarDays: opts.solarDays,
            payloadType: 'default',
            payload: ''
        }
        if (validateOpt(opt)) {
            const pos = coordParser(opt.location)
            const offset = isNumber(opt.offset) ? parseInt(opt.offset) : 0
            const nowOffset = new Date(now.getTime() - offset * 60000)
            const daysOfWeek = opt?.solarDays || null

            result = getSolarTimes(pos.lat, pos.lon, 0, solarEvents, now, offset, daysOfWeek, timeZone, use24HourFormat, locale)
            // eslint-disable-next-line eqeqeq
            if (opts.includeSolarStateOffset && offset != 0) {
                const ssOffset = getSolarTimes(pos.lat, pos.lon, 0, solarEvents, nowOffset, 0, daysOfWeek, timeZone, use24HourFormat, locale)
                result.solarStateOffset = ssOffset.solarState
            }
            result.offset = offset
            result.now = now
            result.nowOffset = nowOffset
            ds = parseDateSequence(result.eventTimes.map((event) => event.timeOffset))
            dsOk = ds && ds.isDateSequence
            result.valid = dsOk
        }
    } else {
        if (expressionType === 'cron' || expressionType === '') {
            exOk = cronosjs.validate(expression)

            result.valid = exOk
        } else {
            ds = parseDateSequence(expression)
            dsOk = ds.isDateSequence
            result.valid = dsOk
        }
        if (!exOk && !dsOk) {
            result.description = 'Invalid expression'
            result.valid = false
            return result
        }
    }

    if (dsOk) {
        const task = ds.task
        const dates = ds.dates
        const dsFutureDates = dates.filter(d => d >= now)
        const dsLastDates = dates.filter(d => d <= now)
        const count = dsFutureDates ? dsFutureDates.length : 0
        result.description = 'Date sequence with fixed dates'

        if (task && task._sequence && count) {
            result.nextDate = dsFutureDates[0]
            result.previousDate = dsLastDates[dsLastDates.length - 1]
            const ms = result.nextDate.valueOf() - now.valueOf()
            const msLast = result.previousDate ? now.valueOf() - result.previousDate.valueOf() : 0

            result.prettyNext = (result.nextEvent ? getSolarEventName(result.nextEvent) + ' ' : '') + futureMs(ms)
            result.prettyPrevious = msLast > 0 ? (result.lastEvent ? getSolarEventName(result.lastEvent) + ' ' : '') + pastMs(msLast) : never
            if (expressionType === 'solar') {
                if (solarType === 'all') {
                    result.description = 'All Solar Events'
                } else {
                    const solarEventsArray = solarEvents.split(',')
                    const events = solarEventsArray.map(event => getSolarEventName(event)).join(', ')
                    result.description = events + ((opts.solarDays && opts.solarDays.length) ? ', ' + opts.solarDays.map(day => getDayAbbreviation(day)).join(', ') : '')
                }
            } else {
                if (count === 1) {
                    result.description = 'One time at ' + formatShortDateTimeWithTZ(result.nextDate, timeZone, use24HourFormat, locale)
                } else {
                    result.description = count + ' Date Sequences starting at ' + formatShortDateTimeWithTZ(result.nextDate, timeZone, use24HourFormat, locale)
                }
                result.nextDates = dsFutureDates.slice(0, 5)
                result.prevDates = dsLastDates.slice(-5)
            }
        }
    }

    if (exOk) {
        const ex = cronosjs.CronosExpression.parse(expression, cronOpts)
        const next = ex.nextDate()
        // Add 1 second to the current time to avoid edge cases where the previous date is the same as the current date
        const nowPlus = new Date(now.getTime() + 1000)
        const previous = ex.previousDate(nowPlus, false)
        if (next) {
            const ms = next.valueOf() - now.valueOf()
            result.prettyNext = (result.nextEvent ? getSolarEventName(result.nextEvent) + ' ' : '') + futureMs(ms)
        }
        try {
            result.nextDates = ex.nextNDates(now, 5)
        } catch (error) {
            console.debug(error)
        }
        if (previous) {
            const msLast = now.valueOf() - previous.valueOf()
            result.prettyPrevious = pastMs(msLast)
            try {
                result.prevDates = ex.previousNDates(nowPlus, 5)
            } catch (error) {
                console.debug(error)
            }
        } else {
            // result.description = 'Invalid expression'
            // result.valid = false
            // return result
        }

        result.description = humanizeCron(expression, locale, use24HourFormat)
        result.nextDate = next
        result.previousDate = previous
    }
    return result
}

/**
     * Formats a given date into a short date-time string with timezone information.
     *
     * @param {string|Date} date - The date to format. Can be a date string or a Date object.
     * @param {string} tz - The timezone identifier (e.g., 'America/New_York').
     * @param {boolean} [use24HourFormat=true] - Whether to use 24-hour format. Defaults to true.
     * @param {string} [locale='en'] - The locale to use for formatting. Defaults to 'en'.
     * @returns {string} The formatted date-time string or an error message if formatting fails.
     */
function formatShortDateTimeWithTZ (date, tz, use24HourFormat = true, locale = 'en') {
    if (!date) {
        return ''
    }
    let dateString
    const o = {
        locale, // Specify the locale
        timeZone: tz || undefined,
        timeZoneName: 'short',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: use24HourFormat ? 'h23' : 'h12'
    }
    try {
        dateString = new Intl.DateTimeFormat(locale, o).format(new Date(date))
    } catch (error) {
        dateString = 'Error. Check timezone or locale setting'
    }

    return dateString
}

/**
     * Determine if a variable is a number
     * @param {string|number} n The string or number to test
     * @returns {boolean}
     */
function isNumber (n) {
    return !isNaN(parseFloat(n)) && isFinite(n)
}

/**
     * Determine if a variable is a valid object
     * NOTE: Arrays are also objects - be sure to use Array.isArray if you need to know the difference
     * @param {*} o The variable to test
     * @returns {boolean}
     */
function isObject (o) {
    return (typeof o === 'object' && o !== null)
}

/**
     * Determine if a variable is a valid date
     * @param {*} d The variable to test
     * @returns {boolean}
     */
function isValidDateObject (d) {
    return d instanceof Date && !isNaN(d)
}

/**
     * Determine if a variable is a cron like string
     * @param {string} expression The variable to test
     * @returns {boolean}
     */
function isCronLike (expression) {
    if (typeof expression !== 'string') return false
    if (expression.includes('*')) return true
    const cleaned = expression.replace(/\s\s+/g, ' ')
    const spaces = cleaned.split(' ')
    return spaces.length >= 4 && spaces.length <= 6
}

/**
     * Apply defaults to the cron schedule object
     * @param {integer} optionIndex An index number to use for defaults
     * @param {object} option The option object to update
    */
function applyOptionDefaults (node, option, optionIndex) {
    if (isObject(option) === false) {
        return// no point in continuing
    }
    optionIndex = optionIndex == null ? 0 : optionIndex
    // eslint-disable-next-line eqeqeq
    if (option.expressionType == '') {
        if (isDateSequence(option.expression)) {
            option.expressionType = 'dates'
        } else {
            option.expressionType = 'cron'// if empty, default to cron
        }
    } else if (['cron', 'dates', 'solar'].indexOf(option.expressionType) < 0) {
        // if expressionType is not cron or solar - it might be sunrise or sunset from an older version
        if (option.expressionType === 'sunrise') {
            option.solarEvents = option.solarEvents || 'sunrise'
            option.expressionType = 'solar'
        } else if (option.expressionType === 'sunset') {
            option.solarEvents = option.solarEvents || 'sunset'
            option.expressionType = 'solar'
        } else {
            option.expressionType = 'cron'
        }
    }
    // option.name = option.name || 'schedule' + (optionIndex + 1)
    option.topic = option.topic || option.name
    option.payloadType = option.payloadType || option.type
    if (option.payloadType == null && typeof option.payload === 'string' && option.payload.length) {
        option.payloadType = 'str'
    }
    option.payloadType = option.payloadType || 'default'
    delete option.type
    if (option.expressionType === 'cron' && !option.expression) option.expression = '0 * * * * * *'
    if (option.expressionType === 'solar') {
        if (!option.solarType) option.solarType = option.solarEvents ? 'selected' : 'all'
        if (!option.solarEvents) option.solarEvents = 'sunrise,sunset'
        if (!option.location) option.location = node.defaultLocation || ''
        option.locationType = node.defaultLocationType || 'fixed'
    }
    option.locale = node.locale || 'en'
    option.timezone = node.timezone || 'UTC'
    option.timeFormat = node.use24HourFormat || '24'
}

/**
     * Calculates the next occurrence of a specified weekday from a given start date.
     *
     * @param {string[]} weekdays - An array of weekday names to search for the next occurrence.
     * @param {Date} [startDate=new Date()] - The date from which to start the search. Defaults to the current date.
     * @returns {Date} The date of the next occurrence of one of the specified weekdays.
     */
function getNextWeekday (weekdays, startDate = new Date()) {
    const start = new Date(startDate)
    const startIndex = start.getDay()
    let minDays = 7 // initialize with maximum days in a week
    const now = new Date()

    if (weekdays === null || !Array.isArray(weekdays) || weekdays.length === 0) {
        weekdays = allDaysOfWeek
    }

    weekdays.forEach(day => {
        const dayIndex = allDaysOfWeek.indexOf(day)
        if (dayIndex === -1) {
            //
        }

        const daysUntilNext = (dayIndex - startIndex + 7) % 7
        if (daysUntilNext < minDays) {
            minDays = daysUntilNext
        }
    })
    // Calculate the next occurring weekday date
    const nextDate = new Date(start.getTime() + minDays * 24 * 60 * 60 * 1000)
    // Check if the nextDate at 00:00 is still greater than now UTC

    const tempNextDate = new Date(nextDate)
    tempNextDate.setHours(0, 0, 0, 0)

    if (tempNextDate > now) {
        return tempNextDate
    }
    return new Date(nextDate)
}

/**
     * Calculates the most recent occurrence of a specified weekday before a given start date.
     *
     * @param {string[]} weekdays - An array of weekday names to consider. If empty or not provided, all days of the week are considered.
     * @param {Date} [startDate=new Date()] - The date from which to start the search. Defaults to the current date.
     * @returns {Date} The date of the last occurrence of one of the specified weekdays.
     */
function getLastWeekday (weekdays, startDate = new Date()) {
    if (!weekdays || weekdays.length === 0) {
        weekdays = allDaysOfWeek
    }
    const start = new Date(startDate)
    const startIndex = start.getDay()
    let minDays = 7 // initialize with maximum days in a week

    if (weekdays === null || !Array.isArray(weekdays) || weekdays.length === 0) {
        weekdays = allDaysOfWeek
    }

    weekdays.forEach(day => {
        const dayIndex = allDaysOfWeek.indexOf(day)
        if (dayIndex === -1) {
            //
        }

        const daysUntilLast = (startIndex - dayIndex + 7) % 7

        if (daysUntilLast !== 0 && daysUntilLast < minDays) {
            minDays = daysUntilLast
        }
    })

    // Calculate the last occurring weekday date
    const lastDate = new Date(start.getTime() - minDays * 24 * 60 * 60 * 1000)

    // Check if the lastDate at 00:00 is still less than now UTC
    const tempLastDate = new Date(lastDate)
    tempLastDate.setHours(0, 0, 0, 0)

    if (tempLastDate < new Date()) {
        return tempLastDate
    }
    return new Date(lastDate)
}

/**
     * Retrieves the most recent event from a list of events that matches a specified
     * solar event and occurred before or at the current time.
     *
     * @param {Array} events - An array of event objects, each containing an 'event' and 'timeOffset'.
     * @param {Array} solarEventsArr - An array of solar event names to match against.
     * @param {Date} now - The current date and time used to compare event occurrences.
     * @returns {Object|null} The most recent matching event object, or null if no match is found.
     */
function getLastOccurredEvent (events, solarEventsArr, now) {
    for (let i = events.length - 1; i >= 0; i--) {
        const item = events[i]
        if (solarEventsArr.includes(item.event) && new Date(item.timeOffset) <= now) {
            return item
        }
    }
    return null // If no matching event is found
}

/**
     * Calculates the next occurrence of a specified time on or after a given start date.
     *
     * @param {Date} startDate - The starting date from which to calculate the next occurrence.
     * @param {string} timeString - The time in 'HH:MM' format to find the next occurrence of.
     * @returns {Date} A Date object representing the next occurrence of the specified time.
     */
function getNextTimeOccurrence (node, startDate, timeString) {
    if (!startDate) startDate = new Date()
    if (!timeString) timeString = '00:00'

    // Parse the input time string
    const timeArray = timeString.split(':').map(Number)

    const date = new Date(startDate)
    const tz = getCurrentTimezone(node)
    const adjustedDate = setTimeForTZ(date, tz, timeArray)

    // If the time has already passed for the current day, add one day
    if (adjustedDate < new Date(startDate)) {
        adjustedDate.setDate(adjustedDate.getDate() + 1)
    }

    return adjustedDate
}

/**
     * Calculates the next occurrences of a time interval from the start of the year.
     *
     * @param {number} interval - The interval between occurrences, must be a positive number.
     * @param {string} unit - The unit of time for the interval, either 'minute' or 'hour'.
     * @param {number} [count=1] - The number of occurrences to calculate.
     * @returns {Date[]} An array of Date objects representing the next occurrences.
     * @throws {Error} Throws an error if the interval is not positive or if the unit is invalid.
     */
function getNextIntervalOccurrences (interval, unit, count = 1) {
    const now = new Date()
    const anchor = startOfYear(now) // Anchor: January 1st, 00:00

    if (interval <= 0) {
        throw new Error('Interval must be a positive number.')
    }

    const occurrences = []
    if (unit === 'minute') {
        const totalMinutesSinceAnchor = Math.ceil((now - anchor) / (1000 * 60)) // Minutes since Jan 1st
        const nextOccurrenceInMinutes = Math.ceil(totalMinutesSinceAnchor / interval) * interval

        for (let i = 0; i < count; i++) {
            occurrences.push(addMinutes(anchor, nextOccurrenceInMinutes + i * interval)) // Add intervals
        }
    } else if (unit === 'hour') {
        const totalHoursSinceAnchor = Math.ceil((now - anchor) / (1000 * 60 * 60)) // Hours since Jan 1st
        const nextOccurrenceInHours = Math.ceil(totalHoursSinceAnchor / interval) * interval

        for (let i = 0; i < count; i++) {
            occurrences.push(addHours(anchor, nextOccurrenceInHours + i * interval)) // Add intervals
        }
    } else {
        throw new Error('Unit must be either "minute" or "hour".')
    }

    return occurrences
}

/**
     * Generates a sequence of past date occurrences based on a specified interval and unit.
     *
     * @param {number} interval - The interval between occurrences, must be a positive number.
     * @param {string} unit - The unit of time for the interval, either 'minute' or 'hour'.
     * @param {number} [count=1] - The number of past occurrences to generate, must be a positive number.
     * @returns {Date[]} An array of Date objects representing the past occurrences.
     * @throws {Error} If the interval is not a positive number or if the unit is invalid.
     */
function getPreviousIntervalOccurrences (interval, unit, count = 1) {
    const now = new Date()
    const anchor = startOfYear(now) // Anchor: January 1st, 00:00

    if (interval <= 0) {
        throw new Error('Interval must be a positive number.')
    }

    const occurrences = []
    if (unit === 'minute') {
        const totalMinutesSinceAnchor = Math.floor((now - anchor) / (1000 * 60)) // Minutes since Jan 1st
        const lastOccurrenceInMinutes = Math.floor(totalMinutesSinceAnchor / interval) * interval
        for (let i = count - 1; i >= 0; i--) { // Reverse the loop
            occurrences.push(addMinutes(anchor, lastOccurrenceInMinutes - i * interval))
        }
    } else if (unit === 'hour') {
        const totalHoursSinceAnchor = Math.floor((now - anchor) / (1000 * 60 * 60)) // Hours since Jan 1st
        const lastOccurrenceInHours = Math.floor(totalHoursSinceAnchor / interval) * interval
        for (let i = count - 1; i >= 0; i--) { // Reverse the loop
            occurrences.push(addHours(anchor, lastOccurrenceInHours - i * interval))
        }
    } else {
        throw new Error('Unit must be either "minute" or "hour".')
    }

    return occurrences
}

/**
     * Determines if a given interval is compatible with cron scheduling
     * based on the specified type ('minute' or 'hour').
     *
     * @param {number} interval - The interval to check for compatibility.
     * @param {string} type - The type of interval, either 'minute' or 'hour'.
     * @returns {boolean} True if the interval is compatible with cron scheduling; otherwise, false.
     * @throws {Error} Throws an error if the type is not 'minute' or 'hour'.
     */
function isCronCompatible (interval, type) {
    if (type === 'minute') {
        return 60 % interval === 0
    } else if (type === 'hour') {
        return 24 % interval === 0
    } else {
        throw new Error("Invalid type. Use 'minute' or 'hour'.")
    }
}

/**
     * Generates a sequence of date occurrences based on a specified interval and unit.
     *
     * @param {number} interval - The interval between occurrences, must be a positive number.
     * @param {string} unit - The unit of time for the interval, either 'minute' or 'hour'.
     * @param {string} [type='both'] - The type of occurrences to generate: 'past', 'future', or 'both'.
     * @param {number} [count=1] - The number of occurrences to generate for each type, must be a positive number.
     * @returns {string} A comma-separated string of ISO formatted date occurrences.
     * @throws {Error} If the interval or count is not a positive number, or if the unit is invalid.
     */
function generateDateSequence (interval, unit, type = 'both', count = 1) {
    if (interval <= 0 || count <= 0) {
        throw new Error('Interval and count must be positive numbers.')
    }

    let pastOccurrences = []
    let futureOccurrences = []

    // Get past and/or future occurrences based on the type
    if (type === 'past' || type === 'both') {
        pastOccurrences = getPreviousIntervalOccurrences(interval, unit, type === 'both' ? 5 : count)
    }
    if (type === 'future' || type === 'both') {
        futureOccurrences = getNextIntervalOccurrences(interval, unit, count)
    }

    // Combine past and future occurrences (past first)
    const allOccurrences = [...pastOccurrences, ...futureOccurrences]

    // Format the occurrences into a comma-separated ISO string
    return allOccurrences.map((date) => date.toISOString()).join(', ')
}

/**
     * Parses a given expression to determine if it represents a valid date sequence.
     *
     * The function checks if the input expression is a string and splits it by commas.
     * Each element is trimmed and checked if it resembles a cron-like expression.
     * If any element is cron-like, the function returns early with a result indicating
     * failure. Otherwise, it attempts to convert each element into a Date object.
     *
     * If the resulting dates can form a valid CronosTask sequence, the function
     * updates the result to indicate success and includes the sequence details.
     *
     * @param {string|Array} expression - The expression to parse, which can be a string
     *                                    of comma-separated values or an array.
     * @returns {Object} An object containing the parsing result, including whether
     *                   the expression is a valid date sequence, the original expression,
     *                   and the parsed dates if successful.
     */
function parseDateSequence (expression) {
    const result = { isDateSequence: false, expression }
    let dates = expression
    if (typeof expression === 'string') {
        const spl = expression.split(',')
        for (let index = 0; index < spl.length; index++) {
            spl[index] = spl[index].trim()
            if (isCronLike(spl[index])) {
                return result// fail
            }
        }
        dates = spl.map(x => {
            if (isNumber(x)) {
                x = parseInt(x)
            }
            const d = new Date(x)
            return d
        })
    }
    const ds = new cronosjs.CronosTask(dates)
    if (ds && ds._sequence) {
        result.dates = ds._sequence._dates
        result.task = ds
        result.isDateSequence = true
    }
    return result
}

/**
     * Parses solar times based on the provided options and returns a task object
     * containing solar event times and a date sequence.
     *
     * @param {Object} opt - Options for parsing solar times.
     * @param {string} [opt.location='0.0,0.0'] - The location coordinates in 'lat,lon' format.
     * @param {number} [opt.offset=0] - The time offset in minutes.
     * @param {string|Date} [opt.date=new Date()] - The date for which to calculate solar times.
     * @param {Array<string>} [opt.solarDays=null] - Days of the week to consider for solar events.
     * @param {string|Array<string>} [opt.solarEvents] - Specific solar events to consider.
     * @param {string} [opt.solarType] - Type of solar events to consider, 'all' for all permitted events.
     * @returns {Object} A task object containing solar event times and a date sequence.
     */
function parseSolarTimes (opt) {
    // opt.location = location || ''
    const pos = coordParser(opt.location || '0.0,0.0')
    const offset = opt.offset ? parseInt(opt.offset) : 0
    const date = opt.date ? new Date(opt.date) : new Date()
    const daysOfWeek = opt.solarDays || null
    const events = opt.solarType === 'all' ? PERMITTED_SOLAR_EVENTS : opt.solarEvents
    const result = getSolarTimes(pos.lat, pos.lon, 0, events, date, offset, daysOfWeek, opt.timezone, opt.timeFormat, opt.locale)
    const task = parseDateSequence(result.eventTimes.map((o) => o.timeOffset))
    task.solarEventTimes = result
    return task
}

/**
     * Calculates solar event times for a given location and date range.
     *
     * @param {number} lat - Latitude of the location.
     * @param {number} lng - Longitude of the location.
     * @param {number} elevation - Elevation of the location (currently unused).
     * @param {string|string[]} solarEvents - Comma-separated string or array of solar events to consider.
     * @param {Date|null} [startDate=null] - Starting date for calculations. Defaults to current date if not provided.
     * @param {number} [offset=0] - Time offset in minutes to apply to event times.
     * @param {string[]|null} [daysOfWeek=null] - Array of weekdays to consider for event calculations.
     * @returns {Object} An object containing solar state, next and last event details, and event times.
     * @throws {Error} Throws an error if solarEvents is not a string or array.
     */
function getSolarTimes (lat, lng, elevation, solarEvents, startDate = null, offset = 0, daysOfWeek = null, timezone = null, timeFormat = null, locale = null) {
    // performance.mark('Start');

    let getNextWeek = false
    let initialStartDate
    let nextType
    let nextTime
    let nextTimeOffset
    let lastType
    let lastTime
    let lastTimeOffset
    const now = new Date()

    offset = isNumber(offset) ? parseInt(offset) : 0
    elevation = isNumber(elevation) ? parseInt(elevation) : 0// not used for now
    startDate = startDate ? new Date(startDate) : new Date()
    for (let retries = 0; retries < 2; retries++) {
        const solarEventsPast = [...PERMITTED_SOLAR_EVENTS]
        const solarEventsFuture = [...PERMITTED_SOLAR_EVENTS]
        const solarEventsArr = []

        // get list of usable solar events into solarEventsArr
        let solarEventsArrTemp = []
        if (typeof solarEvents === 'string') {
            solarEventsArrTemp = solarEvents.split(',')
        } else if (Array.isArray(solarEvents)) {
            solarEventsArrTemp = [...solarEvents]
        } else {
            throw new Error('solarEvents must be a CSV or Array')
        }
        for (let index = 0; index < solarEventsArrTemp.length; index++) {
            const se = solarEventsArrTemp[index].trim()
            if (PERMITTED_SOLAR_EVENTS.includes(se)) {
                solarEventsArr.push(se)
            }
        }

        if (daysOfWeek && daysOfWeek.length > 0) {
            startDate = getNextWeekday(daysOfWeek, startDate)
        }
        if (!getNextWeek) {
            initialStartDate = startDate
        }

        const sorted = getSolarEvents(startDate, solarEventsPast, solarEventsFuture)

        // now scan through sorted solar events to determine day/night/twilight etc
        let state = ''; const solarState = {}
        for (let index = 0; index < sorted.length; index++) {
            const event = sorted[index]
            if (event.time < startDate) {
                switch (event.event) {
                case 'nightEnd':
                    state = 'Astronomical Twilight'// todo: i18n
                    updateSolarState(solarState, state, 'rise', false, false, true, false, false, false, false)
                    break
                    // case "astronomicalDawn":
                    //     state = "Astronomical Twilight";//todo: i18n
                    //     updateSolarState(solarState,state,"rise",false,false,true,false,false,false,false);
                    //     break;
                case 'nauticalDawn':
                    state = 'Nautical Twilight'
                    updateSolarState(solarState, state, 'rise', false, false, false, true, false, false, false)
                    break
                case 'civilDawn':
                    state = 'Civil Twilight'
                    updateSolarState(solarState, state, 'rise', false, false, false, false, true, true, false)
                    break
                    // case "morningGoldenHourStart":
                    //     updateSolarState(solarState,null,"rise",false,false,false,false,true,true,false);
                    //     break;
                case 'sunrise':
                    state = 'Civil Twilight'
                    updateSolarState(solarState, state, 'rise', false, false, false, false, true, true, false)
                    break
                case 'sunriseEnd':
                    state = 'Day'
                    updateSolarState(solarState, state, 'rise', true, false, false, false, false, true, false)
                    break
                case 'morningGoldenHourEnd':
                    state = 'Day'
                    updateSolarState(solarState, state, 'rise', true, false, false, false, false, false, false)
                    break
                case 'solarNoon':
                    updateSolarState(solarState, null, 'fall')
                    break
                case 'eveningGoldenHourStart':
                    state = 'Day'
                    updateSolarState(solarState, state, 'fall', true, false, false, false, false, false, true)
                    break
                case 'sunsetStart':
                    state = 'Day'
                    updateSolarState(solarState, state, 'fall', true, false, false, false, false, false, true)
                    break
                case 'sunset':
                    state = 'Civil Twilight'
                    updateSolarState(solarState, state, 'fall', false, false, false, false, true, false, true)
                    break
                    // case "eveningGoldenHourEnd":
                    //     state = "Nautical Twilight";
                    //     updateSolarState(solarState,state,"fall",false,false,false,false,true,false,false);
                    //     break;
                case 'civilDusk':
                    state = 'Nautical Twilight'
                    updateSolarState(solarState, state, 'fall', false, false, false, true, false, false, false)
                    break
                case 'nauticalDusk':
                    state = 'Astronomical Twilight'
                    updateSolarState(solarState, state, 'fall', false, false, true, false, false, false, false)
                    break
                    // case "astronomicalDusk":
                case 'night':
                case 'nightStart':
                    state = 'Night'
                    updateSolarState(solarState, state, 'fall', false, true, false, false, false, false, false)
                    break
                case 'nadir':
                    updateSolarState(solarState, null, 'rise')
                    break
                }
            } else {
                break
            }
        }
        // update final states
        updateSolarState(solarState)// only sending `stateObject` makes updateSolarState() compute dawn/dusk etc
        let lastOccurredEvent

        // get last occured event if included
        if ((Math.abs(now - startDate)) <= 60000) {
            lastOccurredEvent = getLastOccurredEvent(sorted, solarEventsArr, now)
        }

        if (lastOccurredEvent) {
            lastType = lastOccurredEvent.event
            lastTime = lastOccurredEvent.time
            lastTimeOffset = lastOccurredEvent.timeOffset
        } else {
            const lastWeekday = getLastWeekday(daysOfWeek, now)
            const sorted = getSolarEvents(lastWeekday, [...PERMITTED_SOLAR_EVENTS], [])
            const lastOccurredEvent = getLastOccurredEvent(sorted, solarEventsArr, now)
            if (lastOccurredEvent) {
                lastType = lastOccurredEvent.event
                lastTime = lastOccurredEvent.time
                lastTimeOffset = lastOccurredEvent.timeOffset
            }
        }
        // now filter to only future events of interest
        const futureEvents = !getNextWeek ? sorted.filter((e) => e && e.timeOffset >= startDate) : sorted.filter((e) => e && e.timeOffset >= initialStartDate)
        const wantedFutureEvents = []
        for (let index = 0; index < futureEvents.length; index++) {
            const fe = futureEvents[index]
            const eventDay = fe.timeOffset.getUTCDay()
            const eventDayName = allDaysOfWeek[eventDay]

            if (solarEventsArr.includes(fe.event) && (!daysOfWeek || daysOfWeek.includes(eventDayName))) {
                wantedFutureEvents.push(fe)
            }
        }

        if (wantedFutureEvents[0] === undefined) {
            startDate = new Date(startDate.getTime() + 1 * 24 * 60 * 60 * 1000)
            getNextWeek = true
        } else if (wantedFutureEvents[0] !== undefined) {
            nextType = wantedFutureEvents[0].event
            nextTime = wantedFutureEvents[0].time
            nextTimeOffset = wantedFutureEvents[0].timeOffset
            return {
                solarState,
                nextEvent: nextType,
                nextEventTime: nextTime,
                nextEventTimeOffset: nextTimeOffset,
                eventTimes: wantedFutureEvents,
                lastEvent: lastType,
                lastEventTime: lastTime,
                lastEventTimeOffset: lastTimeOffset
                // allTimes: sorted,
                // eventTimesByType: resultCategories
            }
        } else {
            return {
                solarState: {},
                nextEvent: 'N.A.',
                nextEventTime: 'N.A.',
                nextEventTimeOffset: 'N.A.',
                eventTimes: [],
                lastEvent: lastType || 'N.A.',
                lastEventTime: lastTime || 'N.A.',
                lastEventTimeOffset: lastTimeOffset || 'N.A.'
                // allTimes: sorted,
                // eventTimesByType: resultCategories
            }
        }
    }
    console.log('failed getting solar times')
    return {
        solarState: {},
        nextEvent: 'N.A.',
        nextEventTime: 'N.A.',
        nextEventTimeOffset: 'N.A.',
        eventTimes: []
        // allTimes: sorted,
        // eventTimesByType: resultCategories
    }
    // performance.mark('End')
    // performance.measure('SecondScanEnd to End', 'SecondScanEnd', 'End')
    // performance.measure('Start to End', 'Start', 'End')

    function getSolarEvents (startDate, solarEventsPast, solarEventsFuture) {
        let scanDate = new Date(startDate.toDateString()) // new Date(startDate); //scanDate = new Date(startDate.toDateString())
        scanDate.setDate(scanDate.getDate() + 1)// fwd one day to catch times behind of scan day
        let loopMonitor = 0
        const result = []
        // performance.mark('initEnd')
        // performance.measure('Start to Now', 'Start', 'initEnd')
        // performance.mark('FirstScanStart');

        // first scan backwards to get prior solar events
        while (loopMonitor < 3 && solarEventsPast.length) {
            loopMonitor++
            const timesIteration1 = SunCalc.getTimes(scanDate, lat, lng)
            // timesIteration1 = new SolarCalc(scanDate,lat,lng);

            for (let index = 0; index < solarEventsPast.length; index++) {
                const se = solarEventsPast[index]
                const seTime = timesIteration1[se]
                const seTimeOffset = new Date(seTime.getTime() + offset * 60000)
                const localTime = formatShortDateTimeWithTZ(seTimeOffset, timezone, timeFormat, locale)
                if (isValidDateObject(seTimeOffset) && seTimeOffset <= startDate) {
                    result.push({ event: se, time: seTime, timeOffset: seTimeOffset, localTimeOffset: localTime })
                    solarEventsPast.splice(index, 1)// remove that item
                    index--
                }
            }
            scanDate.setDate(scanDate.getDate() - 1)
        }

        scanDate = new Date(startDate.toDateString())
        scanDate.setDate(scanDate.getDate() - 1)// back one day to catch times ahead of current day
        loopMonitor = 0
        // now scan forwards to get future events
        while (loopMonitor < 183 && solarEventsFuture.length) {
            loopMonitor++
            const timesIteration2 = SunCalc.getTimes(scanDate, lat, lng)
            // timesIteration2 = new SolarCalc(scanDate,lat,lng);
            for (let index = 0; index < solarEventsFuture.length; index++) {
                const se = solarEventsFuture[index]
                const seTime = timesIteration2[se]
                const seTimeOffset = new Date(seTime.getTime() + offset * 60000)
                const localTime = formatShortDateTimeWithTZ(seTimeOffset, timezone, timeFormat, locale)
                if (isValidDateObject(seTimeOffset) && seTimeOffset > startDate) {
                    result.push({ event: se, time: seTime, timeOffset: seTimeOffset, localTimeOffset: localTime })
                    solarEventsFuture.splice(index, 1)// remove that item
                    index--
                }
            }
            scanDate.setDate(scanDate.getDate() + 1)
        }

        // performance.mark('SecondScanEnd');
        // performance.measure('FirstScanEnd to SecondScanEnd', 'FirstScanEnd', 'SecondScanEnd');

        // sort the results to get a timeline
        return result.sort((a, b) => {
            if (a.time < b.time) {
                return -1
            } else if (a.time > b.time) {
                return 1
            } else {
                return 0
            }
        })
    }

    function updateSolarState (stateObject, state, direction, day, night,
        astrologicalTwilight, nauticalTwilight, civilTwilight,
        morningGoldenHour, eveningGoldenHour) {
        if (arguments.length > 1) {
            if (state) stateObject.state = state
            stateObject.direction = direction
            if (arguments.length > 3) {
                stateObject.day = day
                stateObject.night = night
                stateObject.astrologicalTwilight = astrologicalTwilight
                stateObject.nauticalTwilight = nauticalTwilight
                stateObject.civilTwilight = civilTwilight
                stateObject.goldenHour = morningGoldenHour || eveningGoldenHour
                stateObject.twilight = stateObject.astrologicalTwilight || stateObject.nauticalTwilight || stateObject.civilTwilight
            }
            return
        }
        stateObject.morningTwilight = stateObject.direction === 'rise' && stateObject.twilight
        stateObject.eveningTwilight = stateObject.direction === 'fall' && stateObject.twilight
        stateObject.dawn = stateObject.direction === 'rise' && stateObject.civilTwilight
        stateObject.dusk = stateObject.direction === 'fall' && stateObject.civilTwilight
        stateObject.morningGoldenHour = stateObject.direction === 'rise' && stateObject.goldenHour
        stateObject.eveningGoldenHour = stateObject.direction === 'fall' && stateObject.goldenHour
    }
}

/**
     * Exports a schedule object by filtering out undefined properties.
     *
     * @param {Object} schedule - The schedule object containing various properties.
     * @param {string} schedule.id - The unique identifier for the schedule.
     * @param {string} schedule.name - The name of the schedule.
     * @param {string} schedule.topic - The topic associated with the schedule.
     * @param {boolean} schedule.enabled - Indicates if the schedule is enabled.
     * @param {string} schedule.scheduleType - The type of schedule.
     * @param {string} schedule.period - The period of the schedule.
     * @param {string} schedule.time - The time for the schedule.
     * @param {string} schedule.endTime - The end time for the schedule.
     * @param {number} schedule.duration - The duration of the schedule.
     * @param {number} schedule.minutesInterval - The interval in minutes.
     * @param {number} schedule.hourlyInterval - The interval in hours.
     * @param {Array} schedule.days - The days the schedule is active.
     * @param {string} schedule.month - The month the schedule is active.
     * @param {string} schedule.solarEvent - The solar event associated with the schedule.
     * @param {number} schedule.offset - The offset for the solar event.
     * @param {Array} schedule.solarDays - The days the solar schedule is active.
     * @param {string} schedule.solarEventStart - The start of the solar event.
     * @param {string} schedule.solarEventTimespanTime - The timespan for the solar event.
     * @param {string} schedule.startCronExpression - The cron expression for the start.
     * @param {string} schedule.primaryTaskId - The primary task identifier.
     * @param {string} schedule.endTaskId - The end task identifier.
     * @param {string} schedule.payloadType - The type of payload.
     * @param {string} schedule.payloadValue - The value of the payload.
     * @param {string} schedule.endPayloadValue - The value of the end payload.
     * @param {boolean} schedule.isDynamic - Indicates if the schedule is dynamic.
     * @param {boolean} schedule.isStatic - Indicates if the schedule is static.
     * @returns {Object} A new object containing only the defined properties of the schedule.
     */
function exportSchedule (schedule) {
    const {
        id,
        name,
        topic,
        enabled,
        scheduleType,
        period,
        time,
        endTime,
        duration,
        timespan,
        minutesInterval,
        hourlyInterval,
        days,
        month,
        solarEvent,
        offset,
        solarDays,
        solarEventEnd,
        offsetEnd,
        solarEventStart,
        solarEventTimespanTime,
        startCronExpression,
        primaryTaskId,
        endTaskId,
        payloadType,
        payloadValue,
        endPayloadValue,
        isDynamic,
        isStatic
    } = schedule

    // Create the result object and filter out undefined properties
    return Object.fromEntries(
        Object.entries({
            id,
            name,
            topic,
            enabled,
            scheduleType,
            period,
            time,
            endTime,
            duration,
            timespan,
            minutesInterval,
            hourlyInterval,
            days,
            month,
            solarEvent,
            offset,
            solarDays,
            solarEventEnd,
            offsetEnd,
            solarEventStart,
            solarEventTimespanTime,
            startCronExpression,
            primaryTaskId,
            endTaskId,
            payloadType,
            payloadValue,
            endPayloadValue,
            isDynamic,
            isStatic
        }).filter(([_, value]) => value !== undefined)
    )
}

function isTaskFinished (_task) {
    if (!_task) return true
    return _task.node_limit ? _task.node_count >= _task.node_limit : false
}

/**
     * Retrieves the status of a given task, including its scheduling details and execution state.
     *
     * @param {Object} node - The node object containing default location and time zone settings.
     * @param {Object} task - The task object with scheduling expressions and options.
     * @param {Object} opts - Additional options for task evaluation.
     * @param {boolean} [getNextDates=false] - Flag to determine if future dates should be included in the result.
     * @returns {Object} An object containing task status, including descriptions, dates, time zones, and solar event details if applicable.
     */
function getTaskStatus (node, task, opts, getNextDates = false) {
    opts = opts || {}
    opts.locationType = node.defaultLocationType
    opts.defaultLocation = node.defaultLocation
    opts.defaultLocationType = node.defaultLocationType
    opts.solarDays = task.node_opt?.solarDays || null
    opts.date = task.node_opt?.date || null
    const sol = task.node_expressionType === 'solar'
    const exp = sol ? task.node_location : task.node_expression
    const h = _describeExpression(exp, task.node_expressionType, node.timeZone, task.node_offset, task.node_solarType, task.node_solarEvents, opts.date, opts, node.use24HourFormat, node.locale)
    let nextDescription = null
    let nextDate = null
    let lastDescription = null
    let lastDate = null
    const running = !isTaskFinished(task)
    if (running) {
        // nextDescription = h.nextDescription;
        nextDescription = h.prettyNext
        nextDate = sol ? h.nextEventTimeOffset : h.nextDate
        lastDescription = h.prettyPrevious
        lastDate = sol ? h.lastEventTimeOffset : h.previousDate
    }
    let tz = node.timeZone
    let localTZ = ''
    try {
        localTZ = Intl.DateTimeFormat().resolvedOptions().timeZone
        if (!tz) tz = localTZ
        // eslint-disable-next-line no-empty
    } catch (error) { }

    const r = {
        type: task.isDynamic ? 'dynamic' : 'static',
        modified: !!task.modified,
        isRunning: running && task.isRunning,
        count: task.node_count,
        limit: task.node_limit,
        nextDescription,
        lastDescription,
        nextDate: running ? nextDate : null,
        nextDateTZ: running ? formatShortDateTimeWithTZ(nextDate, tz, node.use24HourFormat, node.locale) : null,
        lastDate,
        lastDateTZ: lastDate ? formatShortDateTimeWithTZ(lastDate, tz, node.use24HourFormat, node.locale) : null,
        timeZone: tz,
        serverTime: new Date(),
        serverTimeZone: localTZ,
        description: h.description
    }
    if (getNextDates && h.nextDates && h.nextDates.length) {
        r.nextDates = h.nextDates.map(dateString => {
            const date = new Date(dateString)
            return formatShortDateTimeWithTZ(date, node.timeZone, node.use24HourFormat, node.locale)
        })
    }
    if (getNextDates && h.prevDates && h.prevDates.length) {
        r.lastDates = h.prevDates.map(dateString => {
            const date = new Date(dateString)
            return formatShortDateTimeWithTZ(date, node.timeZone, node.use24HourFormat, node.locale)
        })
    }
    if (sol) {
        r.solarState = h.solarState
        if (h.offset) r.solarStateOffset = h.solarStateOffset
        r.solarTimes = running ? h.eventTimes : null
        r.nextDescription = running ? nextDescription : null// r.solarTimes && (r.solarTimes[0].event + " " + r.nextDescription);
    }
    return r
}

/**
     * Updates the schedule's next status by evaluating the tasks' current state and calculating
     * the duration between primary and end tasks if applicable. It processes solar events and
     * formats descriptions for tasks based on their expression type. If the schedule is disabled,
     * it resets the task status to default values.
     *
     * @param {Object} node - The node object containing default settings and configurations.
     * @param {Object} schedule - The schedule object containing tasks and their statuses.
     * @param {boolean} [getNextDates=true] - Flag to determine if next dates should be retrieved.
     * @returns {Object} The updated schedule with recalculated task statuses and durations.
     */
function updateScheduleNextStatus (node, schedule, getNextDates = true, run = false) {
    const calculateDuration = (start, end) => {
        if (start && end) {
            return new Date(end) - new Date(start) // duration in milliseconds
        }
        return 0
    }

    const updateTaskStatus = (taskObj) => {
        const task = taskObj.task
        const status = getTaskStatus(node, task, { includeSolarStateOffset: true }, getNextDates)
        const { nextDateTZ: nextLocal, nextDate, lastDateTZ: lastLocal, lastDate, nextDescription, nextDates, lastDescription, lastDates, description } = status

        let finalNextDescription = nextDescription || 'Never'
        let finalLastDescription = lastDescription || 'Never'

        if (task.node_expressionType === 'solar') {
            const mapDescription = (description) => description.split(' ').map(word => PERMITTED_SOLAR_EVENTS.includes(word) ? getSolarEventName(word) : word).join(' ')

            finalNextDescription = mapDescription(finalNextDescription)
            finalLastDescription = mapDescription(finalLastDescription)
        }

        return { task, description, nextLocal, nextDescription: finalNextDescription, nextDate, nextDates, lastLocal, lastDescription: finalLastDescription, lastDate, lastDates }
    }

    if (schedule && schedule.enabled) {
        const primaryTaskStatus = schedule.primaryTask?.task ? updateTaskStatus(schedule.primaryTask) : null
        const endTaskStatus = schedule.endTask?.task ? updateTaskStatus(schedule.endTask) : null
        let calculatedDuration = null
        let calculatedDurationPretty = null

        if (primaryTaskStatus && endTaskStatus) {
            const startUTC = (new Date(primaryTaskStatus.nextDate) >= new Date(endTaskStatus.nextDate))
                ? primaryTaskStatus.lastDate
                : primaryTaskStatus.nextDate

            calculatedDuration = calculateDuration(startUTC, endTaskStatus.nextDate)
            calculatedDurationPretty = enhancedMs(calculatedDuration)
            schedule.calculatedDuration = calculatedDuration
            schedule.calculatedDurationPretty = calculatedDurationPretty

            // Calculate active state
            const lastStart = primaryTaskStatus.lastDate ? new Date(primaryTaskStatus.lastDate) : null
            const lastEnd = endTaskStatus.lastDate ? new Date(endTaskStatus.lastDate) : null

            if (lastStart) {
                if (!lastEnd) {
                    schedule.active = true
                    schedule.currentStartTime = primaryTaskStatus.lastDate
                } else {
                    if (lastStart > lastEnd) {
                        schedule.active = true
                        schedule.currentStartTime = primaryTaskStatus.lastDate
                    } else {
                        schedule.active = false
                        schedule.currentStartTime = null
                    }
                }
            } else {
                schedule.active = false
                schedule.currentStartTime = null
            }
        }

        if (primaryTaskStatus) {
            schedule.primaryTask = { ...schedule.primaryTask, ...primaryTaskStatus }
        }

        if (endTaskStatus) {
            schedule.endTask = { ...schedule.endTask, ...endTaskStatus }
        }
    } else {
        const resetTask = (task) => ({
            ...task,
            nextLocal: null,
            nextDescription: 'Never',
            nextDate: null,
            nextDates: [],
            lastLocal: null,
            lastDate: null,
            lastDescription: 'Never',
            lastDates: []
        })

        schedule.primaryTask = resetTask(schedule.primaryTask)
        schedule.endTask = resetTask(schedule.endTask)
    }

    return schedule
}

function getScheduleStatus (node, schedule, getNextDates = true) {
    const calculateDuration = (start, end) => {
        if (start && end) {
            return new Date(end) - new Date(start) // duration in milliseconds
        }
        return 0
    }

    const updateTaskStatus = (taskObj) => {
        const task = taskObj.task
        const status = getTaskStatus(node, task, { includeSolarStateOffset: true }, getNextDates)
        const { nextDateTZ: nextLocal, nextDate, lastDateTZ: lastLocal, lastDate, nextDescription, nextDates, lastDescription, lastDates, description } = status

        let finalNextDescription = nextDescription || 'Never'
        let finalLastDescription = lastDescription || 'Never'

        if (task.node_expressionType === 'solar') {
            const mapDescription = (description) => description.split(' ').map(word => PERMITTED_SOLAR_EVENTS.includes(word) ? getSolarEventName(word) : word).join(' ')

            finalNextDescription = mapDescription(finalNextDescription)
            finalLastDescription = mapDescription(finalLastDescription)
        }

        return { description, nextLocal, nextDescription: finalNextDescription, nextDate, nextDates, lastLocal, lastDescription: finalLastDescription, lastDate, lastDates }
    }

    const resetTask = (task) => ({
        description: '',
        nextLocal: null,
        nextDescription: 'Never',
        nextDate: null,
        nextDates: [],
        lastLocal: null,
        lastDescription: 'Never',
        lastDate: null,
        lastDates: []
    })

    if (schedule && schedule.enabled) {
        const primaryTaskStatus = schedule.primaryTask?.task ? updateTaskStatus(schedule.primaryTask) : resetTask(schedule.primaryTask)
        const endTaskStatus = schedule.endTask?.task ? updateTaskStatus(schedule.endTask) : resetTask(schedule.endTask)
        let calculatedDuration = null
        let calculatedDurationPretty = null

        if (primaryTaskStatus && endTaskStatus && primaryTaskStatus.nextDate && endTaskStatus.nextDate) {
            const startUTC = (new Date(primaryTaskStatus.nextDate) >= new Date(endTaskStatus.nextDate))
                ? primaryTaskStatus.lastDate
                : primaryTaskStatus.nextDate

            calculatedDuration = calculateDuration(startUTC, endTaskStatus.nextDate)
            calculatedDurationPretty = enhancedMs(calculatedDuration)
        }

        return {
            name: schedule.name,
            enabled: schedule.enabled,
            primaryTask: primaryTaskStatus,
            endTask: endTaskStatus,
            ...(calculatedDuration !== null && { calculatedDuration }),
            ...(calculatedDurationPretty !== null && { calculatedDurationPretty }),
            description: schedule.description,
            ...(schedule.active !== null && { active: schedule.active }),
            ...(schedule.currentStartTime !== null && { currentStartTime: schedule.currentStartTime }),
            count: 0,
            limit: 0,
            timeZone: node.timeZone || 'UTC',
            serverTime: new Date(),
            serverTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        }
    }

    return {
        name: schedule.name,
        enabled: false,
        primaryTask: resetTask(schedule.primaryTask),
        endTask: resetTask(schedule.endTask),
        calculatedDuration: null,
        calculatedDurationPretty: null,
        description: schedule.description,
        active: false,
        currentStartTime: null,
        count: 0,
        limit: 0,
        timeZone: node.timeZone || 'UTC',
        serverTime: new Date(),
        serverTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    }
}

let userDir = ''
let persistPath = ''
let FSAvailable = false
let contextAvailable = false
const schedulerDir = 'schedulerdata'

module.exports = function (RED) {
    const STORE_NAMES = getStoreNames()
    // when running tests, RED.settings.userDir & RED.settings.settingsFile (amongst others) are undefined
    const testMode = typeof RED.settings.userDir === 'undefined' && typeof RED.settings.settingsFile === 'undefined'
    if (testMode) {
        FSAvailable = false
        contextAvailable = false
    } else {
        userDir = RED.settings.userDir || ''
        persistPath = path.join(userDir, schedulerDir)
        try {
            if (!fs.existsSync(persistPath)) {
                fs.mkdirSync(persistPath)
            }
            FSAvailable = fs.existsSync(persistPath)
        } catch (e) {
            if (e.code !== 'EEXIST') {
                RED.log.error(`scheduler: Error creating persistence folder '${persistPath}'. ${e.message}`)
                FSAvailable = false
            }
        }
        contextAvailable = STORE_NAMES.length > 2 // 1st 2 are 'none' and 'local_file_system', any others are context stores
    }

    // #region Node-RED
    function SchedulerNode (config) {
        RED.nodes.createNode(this, config)
        const node = this
        const group = RED.nodes.getNode(config.group)
        const base = group.getBase()

        // set locale
        config.locale = setLocale(config, RED.settings.lang)
        node.locale = config.locale

        // init milliseconds formatter for locale
        initializeMs(node.locale)

        // apply localized words
        applyLocalizedSolarEventNames(RED)
        applyLocalizedDayNames(RED)
        applyLocalizedWords(RED)

        node.payloadType = config.payloadType || config.type || 'default'
        // delete config.type
        node.payload = config.payload
        node.crontab = config.crontab
        node.outputField = config.outputField || 'payload'
        node.timeZone = config.timeZone
        node.use24HourFormat = config.use24HourFormat

        node.options = config.options
        node.commandResponseMsgOutput = config.commandResponseMsgOutput || 'output1'
        node.defaultLocation = config.defaultLocation
        node.defaultLocationType = config.defaultLocationType
        node.outputs = config.outputs || 1
        node.sendStateInterval = config.sendStateInterval
        node.sendActiveState = config.sendActiveState
        node.sendInactiveState = config.sendInactiveState
        node.topics = config.topics || ['Topic 1']
        node.customPayloads = config.customPayloads || []
        node.fanOut = false

        node.queuedSerialisationRequest = null
        node.serialisationRequestBusy = null
        node.postponeSerialisation = true

        // set ui option defaults
        config.uiOptionTime = config.uiOptionTime ?? true
        config.uiOptionSolar = config.uiOptionSolar ?? true
        config.uiOptionCron = config.uiOptionCron ?? true
        config.uiOptionPeriod = config.uiOptionPeriod ?? 'daily'
        config.uiOptionMinute = config.uiOptionMinute ?? true
        config.uiOptionHour = config.uiOptionHour ?? true
        config.uiOptionDay = config.uiOptionDay ?? true
        config.uiOptionWeek = config.uiOptionWeek ?? true
        config.uiOptionMonth = config.uiOptionMonth ?? true
        config.uiOptionYear = config.uiOptionYear ?? true
        config.uiOptionTopic = config.uiOptionTopic ?? true
        config.uiOptionTimespan = config.uiOptionTimespan ?? true
        config.uiOptionCustomOutput = config.uiOptionCustomOutput ?? true
        config.uiOptionNewTimePicker = config.uiOptionNewTimePicker ?? false

        checkForUpdate(version, packageName, (result) => {
            if (result) {
                node.updateAvailable = config.updateAvailable = result.updateAvailable
                node.currentVersion = config.currentVersion = result.currentVersion
                node.latestVersion = config.latestVersion = result.latestVersion
                const m = { payload: { updateResult: { ...result } } }
                base.emit('msg-input:' + node.id, m, node)
            } else {
                console.log('Failed to check for updates.')
            }
        })

        setInterval(async function () {
            if (node.serialisationRequestBusy) return
            if (node.queuedSerialisationRequest) {
                node.serialisationRequestBusy = node.queuedSerialisationRequest
                await serialise()
                node.queuedSerialisationRequest = null
                node.serialisationRequestBusy = null
            }
        }, 2500) // 2.5 seconds

        const hasStoreNameProperty = Object.prototype.hasOwnProperty.call(config, 'storeName') && typeof config.storeName === 'string'
        if (hasStoreNameProperty) {
            // not an upgrade - let use this property
            node.storeName = config.storeName
        } else {
            // default
            node.storeName = 'local_file_system'
        }

        if (node.storeName && node.storeName !== 'local_file_system' && STORE_NAMES.indexOf(node.storeName) < 0) {
            node.warn(`Invalid store name specified '${node.storeName}' - state will not be persisted for this node`)
            contextAvailable = false
        }

        if (config.commandResponseMsgOutput === 'output2') {
            node.outputs = 2 // 1 output pins (all messages), 2 outputs (schedules out of pin1, command responses out of pin2)
        } else if (config.commandResponseMsgOutput === 'fanOut') {
            node.outputs = 1 + (node.topics ? node.topics.length : 0)
            node.fanOut = true
        } else {
            config.commandResponseMsgOutput = 'output1'
        }
        node.statusUpdatePending = false

        const MAX_CLOCK_DIFF = Number(RED.settings.scheduler_MAX_CLOCK_DIFF || process.env.scheduler_MAX_CLOCK_DIFF || 5000)
        const clockMonitor = setInterval(async function timeChecker () {
            const oldTime = timeChecker.oldTime || new Date()
            const newTime = new Date()
            const timeDiff = newTime - oldTime
            timeChecker.oldTime = newTime
            if (Math.abs(timeDiff) >= MAX_CLOCK_DIFF) {
                node.log('System Time Change Detected - refreshing schedules! If the system time was not changed then this typically occurs due to blocking code elsewhere in your application')
                await refreshTasks(node)
            }
        }, 1000)

        const setProperty = function (msg, field, value) {
            const set = (obj, path, val) => {
                const keys = path.split('.')
                const lastKey = keys.pop()
                // eslint-disable-next-line no-return-assign
                const lastObj = keys.reduce((obj, key) =>
                    obj[key] = obj[key] || {},
                obj)
                lastObj[lastKey] = val
            }
            set(msg, field, value)
        }
        const updateNodeNextInfo = (node, now) => {
            const { schedule, type } = getNextScheduleTask(node)
            if (schedule && type) {
                const indicator = schedule?.isStatic ? 'ring' : 'dot'
                node.nextDate = type === 'primary' ? schedule?.primaryTask?.nextDate : schedule?.endTask?.nextDate
                node.nextEvent = `${schedule.name}-${type === 'primary' ? RED._('ui-scheduler.label.start') : RED._('ui-scheduler.label.end')}`
                node.nextIndicator = indicator
            } else {
                node.nextDate = null
                node.nextEvent = ''
                node.nextIndicator = ''
            }
        }

        function generateSolarDescription (node, cmd) {
            applyOptionDefaults(node, cmd) // Ensuring defaults are applied
            const description = _describeExpression(
                cmd.location, cmd.expressionType, cmd.timeZone || node.timeZone, cmd.offset,
                cmd.solarType, cmd.solarEvents, cmd.time, cmd, node.use24HourFormat, node.locale
            )

            return description
        }

        function generateDescription (node, cmd) {
            // applyOptionDefaults(node, cmd) // Ensuring defaults are applied
            const description = _describeExpression(
                cmd.expression,
                cmd.expressionType,
                cmd.timeZone || node.timeZone,
                cmd.offset,
                cmd.solarType,
                cmd.solarEvents,
                cmd.time,
                cmd,
                node.use24HourFormat, node.locale
            )

            return description
        }

        /**
         * Generates a human-readable description of a cron interval based on the given interval and unit.
         *
         * @param {Object} node - The node object containing locale and time format preferences.
         * @param {number} interval - The interval value, must be a positive number.
         * @param {string} unit - The unit of time for the interval, either "minute" or "hour".
         * @returns {string} A human-readable description of the cron interval.
         * @throws {Error} Throws an error if the interval is not positive or if the unit is invalid.
         */
        function generateIntervalDescription (node, interval, unit) {
            if (interval <= 0) {
                throw new Error('Interval must be a positive number.')
            }
            if (unit !== 'minute' && unit !== 'hour') {
                throw new Error('Unit must be either "minute" or "hour".')
            }

            // Generate the cron expression
            let expression
            if (unit === 'minute') {
                expression = `*/${interval} * * * *` // Cron expression for every 'interval' minutes
            } else if (unit === 'hour') {
                expression = `0 */${interval} * * *` // Cron expression for every 'interval' hours
            }

            // Use the humanizeCron function to get a human-readable description
            const description = humanizeCron(expression, node.locale, node.use24HourFormat)

            // Return the human-readable description
            return description
        }

        function generateScheduleObjectFromNodeOption (node, opt) {
            const convertStringBoolean = (value) => {
                if (value === 'true' || value === true) {
                    return true
                } else if (value === 'false' || value === false) {
                    return false
                }
                return value
            }
            const commonSchedule = {
                id: opt.id || RED.util.generateId(),
                name: opt.name,
                enabled: opt.enabled !== undefined ? opt.enabled : true,
                topic: opt.topic,
                payloadValue: convertStringBoolean(opt.payload),
                payloadType: opt.payloadType,
                isStatic: true
            }

            switch (opt.expressionType) {
            case 'cron':
                return {
                    ...commonSchedule,
                    scheduleType: 'cron',
                    startCronExpression: opt.expression,
                    description: generateDescription(node, opt).description
                }
            case 'solar':
                return {
                    ...commonSchedule,
                    scheduleType: 'solar',
                    solarEvent: opt.solarEvents,
                    offset: opt.offset,
                    description: generateSolarDescription(node, opt).description
                }
            case 'dates':
                return {
                    ...commonSchedule,
                    scheduleType: 'dates',
                    expression: opt.expression,
                    description: generateDescription(node, opt).description
                }
            default:
                return null
            }
        }

        const updateDoneStatus = (node, task) => {
            let indicator = 'dot'
            if (task) {
                indicator = node.nextIndicator || 'dot'
            }
            node.status({ fill: 'green', shape: indicator, text: RED._('ui-scheduler.label.done') + ': ' + formatShortDateTimeWithTZ(Date.now(), node.timeZone, node.use24HourFormat, node.locale) })
            // node.nextDate = getNextTask(node.tasks);
            const now = new Date()
            updateNodeNextInfo(node, now)
            const next = node.nextDate ? new Date(node.nextDate).valueOf() : (Date.now() + 5001)
            const msTillNext = next - now
            if (msTillNext > 5000) {
                node.statusUpdatePending = true
                setTimeout(function () {
                    node.statusUpdatePending = false
                    updateNextStatus(node, true)
                }, 4000)
            }
        }
        const sendMsg = async (node, task, cronTimestamp, manualTrigger, intervalTrigger = false) => {
            const schedule = getScheduleById(node, task.scheduleId)
            const msg = { scheduler: {} }
            msg.topic = schedule.topic || task.node_topic
            msg.scheduler.triggerTimestamp = cronTimestamp
            const se = task.node_expressionType === 'solar' ? node.nextEvent : ''
            msg.scheduler.status = getScheduleStatus(node, schedule, true)
            if (se) msg.scheduler.status.solarEvent = se
            msg.scheduler.config = exportSchedule(schedule)
            if (manualTrigger) msg.manualTrigger = true
            if (intervalTrigger) msg.intervalTrigger = true
            msg.scheduledEvent = !msg.manualTrigger
            const taskType = task.isDynamic ? 'dynamic' : 'static'

            const index = node.topics.findIndex(topic => {
                if (schedule.topic) {
                    return topic === schedule.topic
                } else {
                    return topic === task.node_topic
                }
            })
            if (index === -1) {
                // Handle the case where the topic is not found
                node.error(`Topic "${schedule.topic || task.node_topic}" not found for ${schedule.name || task.name}`)
            }

            if (!intervalTrigger) {
                const indicator = node.nextIndicator || 'dot'
                node.status({ fill: 'green', shape: indicator, text: 'Schedule Started' })
            }
            try {
                if (task.node_payloadType !== 'flow' && task.node_payloadType !== 'global') {
                    let pl
                    if ((task.node_payloadType == null && task.node_payload === '') || task.node_payloadType === 'date') {
                        pl = Date.now()
                    } else if (task.node_payloadType == null) {
                        pl = task.node_payload
                    } else if (task.node_payloadType === 'none') {
                        pl = ''
                    } else if (task.node_payloadType === 'json' && isObject(task.node_payload)) {
                        pl = task.node_payload
                    } else if (task.node_payloadType === 'bin' && Array.isArray(task.node_payload)) {
                        pl = Buffer.from(task.node_payload)
                    } else if (task.node_payloadType === 'custom' && task.node_payload) {
                        const customPayload = node.customPayloads.find(payload => payload.id === task.node_payload)
                        pl = customPayload ? customPayload.value : ''
                    } else if (task.node_payloadType === 'default') {
                        pl = msg.scheduler
                        delete msg.scheduler // To delete or not?
                    } else {
                        pl = await evaluateNodeProperty(task.node_payload, task.node_payloadType, node, msg)
                    }
                    setProperty(msg, node.outputField, pl)
                    node.send(generateSendMsg(node, msg, taskType, index))
                    if (!intervalTrigger) { updateDoneStatus(node, task) }
                } else {
                    const res = await evaluateNodeProperty(task.node_payload, task.node_payloadType, node, msg)
                    setProperty(msg, node.outputField, res)
                    node.send(generateSendMsg(node, msg, taskType, index))
                    if (!intervalTrigger) { updateDoneStatus(node, task) }
                }
            } catch (err) {
                node.error(err, msg)
            }
        }

        /**
             * Sends messages for active or inactive tasks based on the provided topics and node schedules.
             *
             * @param {Object} node - The node object containing schedules and configuration for message sending.
             * @param {number} timestamp - The timestamp to include in the message.
             * @param {Array} [topics=[]] - An optional array of topics to filter which tasks to process.
             *
             * Iterates through the node's schedules to determine active and inactive tasks for the specified topics.
             * Sends messages for tasks that are currently running and match the active state configuration of the node.
             */
        function sendTopicMsg (node, timestamp, topics = []) {
            const schedules = node.schedules || []
            const topicTasks = {}

            // Iterate through schedules to collect topics and tasks
            schedules.forEach((schedule) => {
                if (schedule && (schedule.timespan !== false)) {
                    const isActive = schedule.active
                    let task = null

                    if (topics.includes(schedule.topic) || topics.length === 0) {
                        if (isActive && (!topicTasks[schedule.topic] || !topicTasks[schedule.topic].active)) {
                            task = schedule.primaryTask?.task
                            if (task && task.isRunning) {
                                topicTasks[schedule.topic] = { task, active: true }
                            }
                        } else if (!isActive && !topicTasks[schedule.topic]) {
                            task = schedule.endTask?.task
                            if (task && task.isRunning) {
                                topicTasks[schedule.topic] = { task, active: false }
                            }
                        }
                    }
                }
            })

            // Iterate through topics to send messages
            Object.keys(topicTasks).forEach((topic) => {
                const taskData = topicTasks[topic]
                if (taskData) {
                    const { task, active } = taskData
                    if (active && node.sendActiveState) {
                        sendMsg(node, task, timestamp, false, true)
                    } else if (!active && node.sendInactiveState) {
                        sendMsg(node, task, timestamp, false, true)
                    }
                }
            })
        }

        (async function () {
            let sendStateTask = null
            try {
                node.status({})
                node.nextDate = null

                if (!node.options) {
                    node.status({ fill: 'grey', shape: 'dot', text: 'Nothing set' })
                    return
                }

                node.tasks = []
                node.schedules = []
                const schedules = node.schedules
                base.stores.state.set(base, node, null, 'schedules', [])
                const cmds = []
                for (let iOpt = 0; iOpt < node.options.length; iOpt++) {
                    const opt = node.options[iOpt]
                    const schedule = generateScheduleObjectFromNodeOption(node, opt)
                    schedule.timespan = false
                    const cmd = generateTaskCmd(schedule)
                    if (cmd) {
                        if (cmd.primary) {
                            schedule.primaryTaskId = cmd.id
                        }
                        cmds.push(cmd)
                    }

                    const nodeSchedule = getSchedule(node, schedule.id)
                    if (nodeSchedule) {
                        node.schedules[node.schedules.indexOf(nodeSchedule)] = schedule
                    } else {
                        node.schedules.push(schedule)
                    }
                    node.statusUpdatePending = true
                }

                if (cmds.length > 0) {
                    try {
                        await updateTask(node, cmds, null)

                        // get status
                        schedules.forEach(msgSchedule => {
                            let schedule = getSchedule(node, msgSchedule.id)

                            if (schedule) {
                                schedule = updateScheduleNextStatus(node, schedule, false)
                            } else {
                                console.log('Schedule not found in schedules')
                            }
                        })
                    } catch (error) {
                        console.error(error)
                    }
                }

                // now load dynamic schedules from file
                await deserialise()

                setTimeout(() => {
                    updateNextStatus(node, true)
                }, 200)
                if (node.sendActiveState || node.sendInactiveState) {
                    const seconds = Number(node.sendStateInterval) || 60
                    const expression = cronosjs.CronosExpression.parse(`*/${seconds} * * * * *`)
                    if (sendStateTask) {
                        _deleteTask(sendStateTask)
                    }
                    sendStateTask = new cronosjs.CronosTask(expression)
                    sendStateTask
                        .on('run', (timestamp) => {
                            sendTopicMsg(node, timestamp)
                        })
                        .start()
                }

                // send initial status
                sendTopicMsg(node, Date.now())

                const data = { ...config }
                data.schedules = getUiSchedules(node)
                data.id = node.id
                data.version = version
                data.timeZone = config.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
                analytics(data, 'AKfycbyl1LXSmMQlJRXZ9cDt9PeeUUS34QeYHD2MdGDaw_X-4aXOlH3UCeYMXeBzO0HKN8wt')
                node.postponeSerialisation = false
            } catch (err) {
                if (node.schedules) {
                    const tasks = getTasks(node)
                    tasks.forEach(task => task.stop())
                }
                node.status({ fill: 'red', shape: 'dot', text: 'Error creating schedule' })
                node.error(err)
            }
        })()

        node.on('close', async function (done) {
            // try {
            //     await serialise()
            // } catch (error) {
            //     node.error(error)
            // }
            node.postponeSerialisation = true
            deleteAllTasksFromSchedules(this)
            if (clockMonitor) clearInterval(clockMonitor)
            if (done && typeof done === 'function') done()
        })

        // this.on('input', async function (msg, send, done) {
        //     send = send || function () {
        //         node.send.apply(node, arguments) }
        //     done = done || function (err) {
        //         if (err) {
        //             node.error(err, msg)
        //         }
        //     }
        //     // is this an button press?...
        //     if (!msg.payload && !msg.topic) { // TODO: better method of differentiating between bad input and button press
        //         // await sendMsg(node, node.tasks[0], Date.now(), true)
        //         // done()
        //         // return
        //     }
        async function handleInput (msg) {
            const controlTopic = controlTopics.find(ct => ct.command === msg.topic)
            let payload = msg.payload
            if (controlTopic) {
                if (controlTopic.payloadIsName) {
                    if (!payload || typeof payload !== 'string') {
                        node.error(`Invalid payload! Control topic '${msg.topic}' expects the name of the schedule to be in msg.payload`, msg)
                        return
                    }
                    // emulate the cmd object
                    payload = {
                        command: controlTopic.command,
                        name: payload
                    }
                } else {
                    payload = {
                        command: controlTopic.command,
                        ...payload
                    }
                }
            }

            if (typeof payload !== 'object') {
                return
            }

            try {
                let input = payload
                if (Array.isArray(payload) === false) {
                    input = [input]
                }
                const cmdResponse = function (msg) {
                    return generateSendMsg(node, msg, 'command-response')
                }
                for (let i = 0; i < input.length; i++) {
                    const cmd = input[i]
                    const action = cmd.command || ''
                    // let newMsg = {topic: msg.topic, payload:{command:cmd, result:{}}};
                    const newMsg = RED.util.cloneMessage(msg)
                    newMsg.payload = { command: cmd, result: {} }
                    const cmdAll = action.endsWith('-all')
                    const cmdAllStatic = action.endsWith('-all-static')
                    const cmdAllDynamic = action.endsWith('-all-dynamic')
                    const cmdTopic = action.endsWith('-topic')
                    const cmdActive = action.endsWith('-active')
                    const cmdInactive = action.endsWith('-inactive')
                    const cmdActiveDynamic = action.includes('-active-dynamic')
                    const cmdActiveStatic = action.includes('-active-static')
                    const cmdInactiveDynamic = action.includes('-inactive-dynamic')
                    const cmdInactiveStatic = action.includes('-inactive-static')

                    let cmdFilter = null
                    const actionParts = action.split('-')
                    let mainAction = actionParts[0]
                    if (actionParts.length > 1) mainAction += '-'

                    if (cmdAllDynamic) {
                        cmdFilter = {}
                        cmdFilter.type = 'dynamic'
                    } else if (cmdAllStatic) {
                        cmdFilter = {}
                        cmdFilter.type = 'static'
                    } else if (cmdTopic) {
                        cmdFilter = {}
                        cmdFilter.type = 'topic'
                    } else if (cmdActive) {
                        cmdFilter = {}
                        cmdFilter.type = 'active'
                    } else if (cmdInactive) {
                        cmdFilter = {}
                        cmdFilter.type = 'inactive'
                    } else if (cmdActiveDynamic) {
                        cmdFilter = {}
                        cmdFilter.type = 'active-dynamic'
                    } else if (cmdActiveStatic) {
                        cmdFilter = {}
                        cmdFilter.type = 'active-static'
                    } else if (cmdInactiveDynamic) {
                        cmdFilter = {}
                        cmdFilter.type = 'inactive-dynamic'
                    } else if (cmdInactiveStatic) {
                        cmdFilter = {}
                        cmdFilter.type = 'inactive-static'
                    }
                    if (cmd.topic && cmd.topic !== '') {
                        if (!cmdFilter) cmdFilter = {}
                        cmdFilter.topic = cmd.topic
                    }

                    switch (mainAction) {
                    case 'trigger': // single
                        {
                            const schedule = getScheduleByName(node, cmd.name)
                            if (!schedule) throw new Error(`Manual Trigger failed. Cannot find schedule named '${cmd.name}'`)
                            const primaryTask = schedule?.primaryTask?.task
                            if (primaryTask) {
                                sendMsg(node, primaryTask, Date.now(), true)
                            }
                        }
                        break
                    case 'trigger-': // multiple
                        if (node.schedules) {
                            node.schedules.forEach(schedule => {
                                if (schedule && (cmdAll || scheduleFilterMatch(schedule, cmdFilter))) {
                                    const primaryTask = schedule?.primaryTask?.task
                                    if (primaryTask) {
                                        sendMsg(node, primaryTask, Date.now(), true)
                                    }
                                }
                            })
                        }
                        break
                    case 'describe': // single
                    {
                        const exp = (cmd.expressionType === 'solar') ? cmd.location : cmd.expression
                        applyOptionDefaults(node, cmd)
                        newMsg.payload.result = _describeExpression(exp, cmd.expressionType, cmd.timeZone || node.timeZone, cmd.offset, cmd.solarType, cmd.solarEvents, cmd.time, { includeSolarStateOffset: true, locationType: node.node_locationType }, node.use24HourFormat, node.locale)
                        // sendCommandResponse(newMsg)
                        return cmdResponse(newMsg)
                    }
                    case 'status': // single
                    {
                        const schedule = getScheduleByName(node, cmd.name)
                        if (schedule) {
                            newMsg.payload.result.config = exportSchedule(schedule)
                            newMsg.payload.result.status = getScheduleStatus(node, schedule, true)
                        } else {
                            newMsg.error = `${cmd.name} not found`
                        }
                        // sendCommandResponse(newMsg)
                        updateNextStatus(node, true)
                        return cmdResponse(newMsg)
                    }
                    case 'export': // single
                    {
                        const schedule = getScheduleByName(node, cmd.name)
                        if (schedule) {
                            newMsg.payload.result.config = exportSchedule(schedule)
                        } else {
                            newMsg.error = `${cmd.name} not found`
                        }
                        // sendCommandResponse(newMsg)
                        return cmdResponse(newMsg)
                    }
                    case 'refresh':
                        await refreshTasks(node)
                        break
                    case 'list-': // multiple
                    case 'status-': // multiple
                    {
                        const results = []
                        if (node.schedules) {
                            node.schedules.forEach(schedule => {
                                if (schedule && (cmdAll || scheduleFilterMatch(schedule, cmdFilter))) {
                                    const result = {}
                                    result.config = exportSchedule(schedule)
                                    result.status = getScheduleStatus(node, schedule, true)
                                    results.push(result)
                                }
                            })
                        }
                        newMsg.payload.result = results
                        // sendCommandResponse(newMsg)
                        return cmdResponse(newMsg)
                    }
                    case 'export-': // multiple
                    {
                        const results = []
                        if (node.schedules) {
                            node.schedules.forEach(schedule => {
                                if (schedule && (cmdAll || scheduleFilterMatch(schedule, cmdFilter))) {
                                    results.push(exportSchedule(schedule))
                                }
                            })
                        }
                        newMsg.payload.result = results
                        // sendCommandResponse(newMsg)
                        return cmdResponse(newMsg)
                    }
                    case 'add':
                    case 'update':
                        console.log(cmd)
                        if (cmd && cmd.schedule) {
                            const schedules = []
                            if (Array.isArray(cmd.schedule)) {
                                cmd.schedule.forEach(schedule => {
                                    if (schedule) {
                                        const validationResult = validateSchedule(schedule)
                                        if (validationResult.valid) {
                                            const cleanedSchedule = cleanSchedule(schedule)
                                            if (cleanedSchedule) {
                                                schedules.push(cleanedSchedule)
                                            }
                                        } else {
                                            node.warn(validationResult.message + ' for ' + JSON.stringify(schedule))
                                        }
                                    }
                                })
                            } else {
                                const schedule = cmd.schedule
                                if (schedule) {
                                    const validationResult = validateSchedule(schedule)
                                    if (validationResult.valid) {
                                        const cleanedSchedule = cleanSchedule(schedule)
                                        if (cleanedSchedule) {
                                            schedules.push(cleanedSchedule)
                                        }
                                    } else {
                                        node.warn(validationResult.message + ' for ' + JSON.stringify(schedule))
                                    }
                                }
                            }
                            if (schedules.length) {
                                submitSchedule(schedules)
                            }
                        }
                        break
                    case 'clear':
                    case 'remove-': // multiple
                    case 'delete-': // multiple
                        deleteAllSchedules(node, cmdFilter)
                        updateNextStatus(node, true)
                        updateSchedules(node)
                        requestSerialisation()// update persistence
                        break
                    case 'remove': // single
                    case 'delete': // single
                        deleteSchedule(node, cmd.name)
                        updateNextStatus(node, true)
                        updateSchedules(node)
                        requestSerialisation()// update persistence
                        break
                    case 'start': // single
                        startSchedule(node, getScheduleId(node, cmd.name))
                        updateNextStatus(node, true)
                        updateSchedules(node)
                        requestSerialisation()// update persistence
                        break
                    case 'start-': // multiple
                        startAllSchedules(node, cmdFilter)
                        updateNextStatus(node, true)
                        updateSchedules(node)
                        requestSerialisation()// update persistence
                        break
                    case 'stop': // single
                    case 'pause': // single
                        stopSchedule(node, getScheduleId(node, cmd.name), cmd.command === 'stop')
                        updateNextStatus(node, true)
                        updateSchedules(node)
                        requestSerialisation()// update persistence
                        break
                    case 'stop-': // multiple
                    case 'pause-': {
                        const resetCounter = cmd.command.startsWith('stop-')
                        stopAllSchedules(node, resetCounter, cmdFilter)
                        updateNextStatus(node, true)
                        updateSchedules(node)
                        requestSerialisation()// update persistence
                    }
                        break
                    case 'next':
                        newMsg.payload = null
                        if (node.schedules && node.schedules.length) {
                            const nextTask = getNextScheduleTask(node)
                            if (nextTask) {
                                const primary = nextTask.type === 'primary'
                                const schedule = nextTask.schedule
                                const status = getScheduleStatus(node, schedule, false)
                                if (status) {
                                    newMsg.payload = {
                                        name: schedule.name,
                                        topic: schedule.topic,
                                        next: primary ? schedule.primaryTask?.nextDate : schedule.endTask?.nextDate,
                                        nextLocal: new Date(primary ? schedule.primaryTask?.nextDate : schedule.endTask?.nextDate).toLocaleString(),
                                        timeZone: status.serverTimeZone,
                                        when: primary ? schedule.primaryTask?.nextDescription : schedule.endTask?.nextDescription,
                                        msUntil: new Date(primary ? schedule.primaryTask?.nextDate : schedule.endTask?.nextDate).valueOf() - new Date().valueOf(),
                                        description: primary ? schedule.primaryTask?.description : schedule.endTask?.description
                                    }
                                }
                            }
                        }
                        if (!newMsg.payload) {
                            newMsg.payload = {}
                        }
                        // sendCommandResponse(newMsg)
                        return cmdResponse(newMsg)
                    case 'debug': {
                        const schedule = getScheduleByName(node, cmd.name)
                        const result = {}

                        if (schedule) {
                            const { primaryTask, endTask, name, enabled, topic } = schedule
                            result.name = name
                            result.enabled = enabled
                            result.topic = topic

                            const processTask = (task, key) => {
                                if (task) {
                                    const thisDebug = getTaskStatus(node, task, { includeSolarStateOffset: true })
                                    Object.assign(thisDebug, {
                                        name: task.name,
                                        topic: task.node_topic,
                                        expressionType: task.node_expressionType,
                                        expression: task.node_expression,
                                        location: task.node_location,
                                        offset: task.node_offset,
                                        solarType: task.node_solarType,
                                        solarEvents: task.node_solarEvents
                                    })
                                    result[key] = thisDebug
                                }
                            }

                            processTask(primaryTask?.task, 'primary')
                            processTask(endTask?.task, 'end')

                            newMsg.payload = result
                            // sendCommandResponse(newMsg)
                            return cmdResponse(newMsg)
                        }
                    }
                        break
                    case 'debug-': { // multiple
                        const results = []
                        const schedules = node.schedules || []

                        schedules.forEach(schedule => {
                            const result = {}
                            const { primaryTask, endTask, name, enabled, topic } = schedule
                            result.name = name
                            result.enabled = enabled
                            result.topic = topic

                            const processTask = (task, key) => {
                                if (task) {
                                    const thisDebug = getTaskStatus(node, task, { includeSolarStateOffset: true })
                                    Object.assign(thisDebug, {
                                        name: task.name,
                                        topic: task.node_topic,
                                        expressionType: task.node_expressionType,
                                        expression: task.node_expression,
                                        location: task.node_location,
                                        offset: task.node_offset,
                                        solarType: task.node_solarType,
                                        solarEvents: task.node_solarEvents
                                    })
                                    result[key] = thisDebug
                                }
                            }

                            processTask(primaryTask?.task, 'primary')
                            processTask(endTask?.task, 'end')

                            results.push(result)
                        })

                        // Example of how you might use 'results' array
                        newMsg.payload = results
                        // sendCommandResponse(newMsg)
                        return cmdResponse(newMsg)
                    }
                    }
                }
            } catch (error) {
                msg.error = error
                return msg
                // done(error)
                // node.error(error,msg);
            }
            return msg
        }
        // })

        function getTask (node, id) {
            const schedule = node.schedules.find(function (schedule) {
                return schedule?.primaryTask?.task?.id === id || schedule?.endTask?.task?.id === id
            })

            if (schedule?.primaryTask?.task?.id === id) {
                return schedule.primaryTask.task
            } else if (schedule?.endTask?.task?.id === id) {
                return schedule.endTask.task
            }

            return null // Return null if no matching task is found
        }

        /**
             * Retrieves a schedule object for a given schedule ID from a node's schedules.
             *
             * @param {Object} node - The node containing the schedules array.
             * @param {string|number} id - The unique identifier of the schedule to retrieve.
             * @returns {Object|undefined} The schedule object with the matching ID, or undefined if not found.
             */
        function getSchedule (node, id) {
            const schedule = node.schedules.find(function (schedule) {
                return schedule.id === id
            })
            return schedule
        }

        /**
             * Retrieves a schedule object for a given schedule name from a node's schedules.
             *
             * @param {Object} node - The node object containing the schedules array.
             * @param {string} name - The name of the schedule to retrieve.
             * @returns {Object|undefined} The schedule object with the matching name, or undefined if not found.
             */
        function getScheduleByName (node, name) {
            const schedule = node.schedules.find(function (schedule) {
                return schedule.name === name
            })
            return schedule
        }

        /**
             * Retrieves the schedule ID for a given schedule name from a node's schedules.
             *
             * @param {Object} node - The node containing the schedules.
             * @param {string} name - The name of the schedule to find.
             * @returns {string|null} The ID of the schedule if found, otherwise null.
             */
        function getScheduleId (node, name) {
            if (Array.isArray(node.schedules)) {
                const schedule = node.schedules.find(function (schedule) {
                    return schedule.name === name
                })
                return schedule ? schedule.id : null
            }
            return null // Return null if node.schedules is not an array
        }

        /**
             * Determines if a given schedule is enabled for a given node and schedule ID.
             *
             * @param {Object} node - The node object containing schedules.
             * @param {string} id - The ID of the schedule to check.
             * @returns {boolean|null} - Returns true if the schedule is enabled, false if disabled, or null if not found.
             */
        function isScheduleEnabled (node, id) {
            const schedule = node.schedules.find(function (schedule) {
                return schedule.id === id
            })
            return schedule.enabled || null
        }

        async function refreshTasks (node) {
            const tasks = getTasks(node)
            if (tasks) {
                try {
                    // let now = new Date();
                    if (!tasks || !tasks.length) { return null }

                    const tasksToRefresh = tasks.filter(function (task) {
                        return task._sequence || (isScheduleEnabled(task.scheduleId) && task._expression && !isTaskFinished(task))
                    })
                    if (!tasksToRefresh || !tasksToRefresh.length) {
                        return null
                    }
                    for (let index = 0; index < tasks.length; index++) {
                        const task = tasks[index]
                        if (task.node_expressionType === 'cron') {
                            task.stop()
                            task.start()
                        } else {
                            let cmd = null
                            if (task?.selfRenew) {
                                const schedule = getScheduleById(node, task.scheduleId)
                                if (schedule) {
                                    cmd = generateTaskCmd(schedule)
                                }
                            }
                            await updateTask(node, cmd || task.node_opt, null)
                        }
                        // task.runScheduledTasks();
                        // index--;
                    }
                } catch (e) { }
                updateNextStatus(node)
            }
        }

        /**
             * Determines if a given schedule matches a specified filter criteria.
             *
             * @param {Object} schedule - The schedule object to be evaluated.
             * @param {Object} filter - The filter criteria containing type and topic.
             * @param {string} filter.type - The type of filter to apply (e.g., 'all', 'static', 'dynamic', 'topic', 'active', 'inactive', 'active-dynamic', 'active-static', 'inactive-dynamic', 'inactive-static').
             * @param {string|null} filter.topic - The topic to match against the schedule's topic.
             * @returns {boolean} - Returns true if the schedule matches the filter criteria, otherwise false.
             */
        function scheduleFilterMatch (schedule, filter) {
            if (!schedule) return false
            const { type, topic } = filter
            const isActive = function (schedule) { return schedule.enabled === true }
            const isInactive = function (schedule) { return schedule.enabled === false }
            const isStatic = function (schedule) { return (schedule.isStatic === true || schedule.isDynamic === false) }
            const isDynamic = function (schedule) { return (schedule.isDynamic === true || schedule.isStatic === false) }
            const isTopicMatch = function (schedule, topic) { return (topic !== null && schedule.topic === topic) }

            switch (type) {
            case 'all':
                return true
            case 'static':
                return isStatic(schedule)
            case 'dynamic':
                return isDynamic(schedule)
            case 'topic':
                return isTopicMatch(schedule, topic)
            case 'active':
                return isActive(schedule)
            case 'inactive':
                return isInactive(schedule)
            case 'active-dynamic':
                return isActive(schedule) && isDynamic(schedule)
            case 'active-static':
                return isActive(schedule) && isStatic(schedule)
            case 'inactive-dynamic':
                return isInactive(schedule) && isDynamic(schedule)
            case 'inactive-static':
                return isInactive(schedule) && isStatic(schedule)
            }
            return false
        }

        function startSchedule (node, id) {
            const schedule = getSchedule(node, id)

            if (schedule) {
                if (!schedule.invalid) {
                    const primaryTask = schedule?.primaryTask?.task
                    const endTask = schedule?.endTask?.task
                    if (primaryTask) {
                        if (isTaskFinished(primaryTask)) {
                            primaryTask.node_count = 0
                        }
                        primaryTask.stop()// prevent bug where calling start without first calling stop causes events to bunch up
                        primaryTask.start()
                    }
                    if (endTask) {
                        if (isTaskFinished(endTask)) {
                            endTask.node_count = 0
                        }
                        endTask.stop()// prevent bug where calling start without first calling stop causes events to bunch up
                        endTask.start()
                    }
                } else {
                    console.log('Schedule invalid', id)
                    node.warn('Schedule invalid', id)
                }
            } else {
                console.log('Schedule not found for', id)
                node.warn('No schedule found for', id)
            }
        }

        function startAllSchedules (node, filter) {
            if (node.schedules) {
                node.schedules.forEach(schedule => {
                    let skip = false
                    if (filter) skip = (scheduleFilterMatch(schedule, filter) === false)
                    if (!skip && schedule) {
                        // if (isTaskFinished(schedule)) {
                        //     schedule.node_count = 0
                        // }
                        startSchedule(node, schedule.id)
                    }
                })
            }
        }

        function stopSchedule (node, id, resetCounter = true) {
            const schedule = getSchedule(node, id)

            if (schedule) {
                if (schedule) {
                    const primaryTask = schedule?.primaryTask?.task
                    const endTask = schedule?.endTask?.task
                    if (primaryTask) {
                        primaryTask.stop()
                        if (resetCounter) { primaryTask.node_count = 0 }
                    }
                    if (endTask) {
                        endTask.stop()
                        if (resetCounter) { endTask.node_count = 0 }
                    }
                }
            } else {
                console.log('Schedule not found for', id)
                node.warn('No schedule found for', id)
            }
        }

        function stopAllSchedules (node, resetCounter, filter) {
            if (node.schedules) {
                node.schedules.forEach(schedule => {
                    let skip = false
                    if (filter) skip = (scheduleFilterMatch(schedule, filter) === false)
                    if (!skip && schedule) {
                        // if (isTaskFinished(schedule)) {
                        //     schedule.node_count = 0
                        // }
                        stopSchedule(node, schedule.id, resetCounter)
                    }
                })
            }
        }

        function getTasks (node) {
            if (node.schedules) {
                return node.schedules.reduce((tasks, schedule) => {
                    if (schedule?.primaryTask?.task) {
                        tasks.push(schedule.primaryTask.task)
                    }
                    if (schedule?.endTask?.task) {
                        tasks.push(schedule.endTask.task)
                    }
                    return tasks
                }, [])
            }
            return []
        }

        function deleteAllTasksFromSchedules (node, filter) {
            if (node.schedules) {
                node.schedules.forEach(schedule => {
                    let skip = false

                    if (filter) skip = (scheduleFilterMatch(schedule, filter) === false)

                    if (!skip) {
                        try {
                            let primaryTask = schedule?.primaryTask?.task
                            let endTask = schedule?.endTask?.task
                            if (primaryTask) {
                                _deleteTask(primaryTask)
                                primaryTask = null
                            }
                            if (endTask) {
                                _deleteTask(endTask)
                                endTask = null
                            }
                            // eslint-disable-next-line no-empty
                        } catch (error) {
                            console.log('deleteAllTasks', error)
                        }
                    }
                })
            }
        }

        function deleteSchedule (node, id) {
            const schedule = getSchedule(node, id)

            if (schedule) {
                let primaryTask = schedule?.primaryTask?.task
                let endTask = schedule?.endTask?.task
                if (primaryTask) {
                    _deleteTask(primaryTask)
                    primaryTask = null
                }
                if (endTask) {
                    _deleteTask(endTask)
                    endTask = null
                }
                node.schedules = node.schedules.filter(s => s && s.id !== id)
                console.log('removed schedule', node.schedules)
            }
        }

        function deleteAllSchedules (node, filter, resetCounter) {
            if (node.schedules) {
                node.schedules.forEach(schedule => {
                    let skip = false
                    if (filter) skip = (scheduleFilterMatch(schedule, filter) === false)
                    if (!skip && schedule) {
                        // if (isTaskFinished(schedule)) {
                        //     schedule.node_count = 0
                        // }
                        deleteSchedule(node, schedule.id, resetCounter)
                    }
                })
            }
        }

        function removeEndTask (node, scheduleId) {
            const schedule = getSchedule(node, scheduleId)

            if (schedule) {
                let endTask = schedule?.endTask?.task
                if (endTask) {
                    _deleteTask(endTask)
                    endTask = null
                }
            }
        }

        function deleteTask (node, id) {
            let task = getTask(node, id)
            if (task) {
                _deleteTask(task)
                task = null
            }
        }

        function _deleteTask (task) {
            try {
                task.off('run')
                task.off('ended')
                task.off('started')
                task.off('stopped')
                task.stop()
                task = null
                // eslint-disable-next-line no-empty
            } catch (error) { }
        }

        function generateUiSchedule (schedule) {
            // Create a shallow copy of the schedule object with deep clones for nested objects
            const uiSchedule = {
                ...schedule,
                primaryTask: schedule.primaryTask ? { ...schedule.primaryTask } : undefined,
                endTask: schedule.endTask ? { ...schedule.endTask } : undefined
            }

            // Remove only the necessary properties
            delete uiSchedule.primaryTask?.task
            delete uiSchedule.endTask?.task

            return uiSchedule
        }

        function getUiSchedules (node) {
            const schedules = base.stores.state.getProperty(node.id, 'schedules') || []
            return schedules
        }

        function getScheduleById (node, scheduleId) {
            const schedules = node.schedules || []
            const scheduleIndex = schedules.findIndex(schedule => schedule.id === scheduleId)
            let schedule = null
            if (scheduleIndex !== -1) {
                // Get the schedule
                schedule = schedules[scheduleIndex]
            }
            return schedule
        }

        function updateSchedules (node, schedules = null) {
            if (schedules) {
                node.schedules = schedules
            }
            updateUISchedules(node)
        }

        function updateUISchedules (node, emitEvent = true) {
            const schedules = node.schedules || []
            const uiSchedules = schedules.map(schedule => generateUiSchedule(schedule))
            base.stores.state.set(base, node, null, 'schedules', uiSchedules)
            if (emitEvent) {
                const m = { ui_update: { schedules: uiSchedules } }
                base.emit('msg-input:' + node.id, m, node)
            }
            return uiSchedules
        }

        function updateSchedule (node, schedule, emitEvent = true, eventName = 'update') {
            const { id } = schedule
            if (!id) {
                console.error("The updated object must have an 'id' property.")
                return
            }

            // Use findIndex to locate the schedule more efficiently
            const index = node.schedules.findIndex(sch => sch.id === id)
            if (index !== -1) {
                node.schedules[index] = { ...node.schedules[index], ...schedule }
            } else {
                console.error(`Schedule with id ${id} not found.`)
                return
            }

            const uiSchedules = updateUISchedules(node)
            // Emit event if required
            if (emitEvent) {
                const m = { ui_update: { schedules: uiSchedules }, event: eventName }
                base.emit('msg-input:' + node.id, m, node)
            }
        }

        async function updateTask (node, options, msg) {
            if (!options || typeof options !== 'object') {
                node.warn('schedule settings are not valid', msg)
                return null
            }

            // eslint-disable-next-line eqeqeq
            if (Array.isArray(options) == false) {
                options = [options]
            }

            for (let index = 0; index < options.length; index++) {
                const opt = options[index]
                opt.payloadType = opt.payloadType || opt.type
                if (opt.payloadType == null && typeof opt.payload === 'string' && opt.payload.length) {
                    opt.payloadType = 'str'
                }
                opt.payloadType = opt.payloadType || 'default'
                delete opt.type
                try {
                    validateOpt(opt)
                } catch (error) {
                    node.warn(error, msg)
                    return
                }
            }

            for (let index = 0; index < options.length; index++) {
                const opt = options[index]
                const task = getTask(node, opt.id)
                const isDynamic = !task || task.isDynamic
                // let isStatic = task && task.isStatic;
                let opCount = 0; let modified = false
                if (task) {
                    modified = true
                    opCount = task.node_count || 0
                    deleteTask(node, opt.id)
                }
                const taskCount = node.tasks ? node.tasks.length : 0
                const taskIndex = task && node.fanOut ? (task.node_index || 0) : taskCount
                const t = await createTask(node, opt, taskIndex, !isDynamic)
                if (t) {
                    if (modified) t.node_modified = true
                    t.node_count = opCount
                    t.isDynamic = isDynamic
                }
            }
        }

        async function createTask (node, opt, index, _static) {
            opt = opt || {}
            try {
                node.debug(`createTask - index: ${index}, static: ${_static}, opt: ${JSON.stringify(opt)}`)
            } catch (error) {
                node.error(error)
            }
            applyOptionDefaults(node, opt, index)
            try {
                validateOpt(opt)
            } catch (error) {
                node.warn(error)
                const indicator = _static ? 'dot' : 'ring'
                node.status({ fill: 'red', shape: indicator, text: error.message })
                return null
            }
            const cronOpts = node.timeZone ? { timezone: node.timeZone } : undefined
            let task
            if (opt.expressionType === 'cron') {
                const expression = cronosjs.CronosExpression.parse(opt.expression, cronOpts)
                task = new cronosjs.CronosTask(expression)
            } else if (opt.expressionType === 'solar') {
                if (node.defaultLocationType === 'env' || node.defaultLocationType === 'fixed') {
                    opt.locationType = node.defaultLocationType
                    opt.location = await evaluateNodeProperty(node.defaultLocation, node.defaultLocationType, node)
                } else { // per schedule
                    opt.location = await evaluateNodeProperty(opt.location, 'str', node)
                }
                const ds = parseSolarTimes(opt)
                task = ds.task
                task.node_solarEventTimes = ds.solarEventTimes
            } else {
                const ds = parseDateSequence(opt.expression)
                task = ds.task
            }
            task.isStatic = _static
            task.id = opt.id
            task.scheduleId = opt.scheduleId
            task.primary = opt.primary
            task.selfRenew = opt.selfRenew
            task.node_topic = opt.topic
            task.node_expressionType = opt.expressionType
            task.node_expression = opt.expression
            task.node_payloadType = opt.payloadType
            task.node_payload = opt.payload
            task.node_count = opt.count || 0
            task.node_locationType = opt.locationType
            task.node_location = opt.location
            task.node_solarType = opt.solarType
            task.node_solarEvents = opt.solarEvents
            task.node_offset = opt.offset
            // task.node_index = index
            task.node_opt = opt
            task.node_limit = opt.limit || 0

            task.stop()
            task.on('run', (timestamp) => {
                const now = new Date()
                node.status({ fill: 'green', shape: 'dot', text: formatShortDateTimeWithTZ(timestamp, node.timeZone, node.use24HourFormat, node.locale) })
                node.debug(`running '${task.name}' ~ '${task.node_topic}'\n now time ${new Date()}\n crontime ${new Date(timestamp)}`)
                const indicator = task.isDynamic ? 'ring' : 'dot'
                node.status({ fill: 'green', shape: indicator, text: 'Running ' + formatShortDateTimeWithTZ(timestamp, node.timeZone, node.use24HourFormat, node.locale) })

                let schedule = getScheduleById(node, task.scheduleId)
                if (schedule) {
                    node.debug(`started '${task.name}' ~ '${task.node_topic}'`)
                    process.nextTick(function () {
                        updateNextStatus(node)
                    })
                    schedule = updateScheduleNextStatus(node, schedule)

                    if (task.primary) {
                        // no timespan schedule
                        if (!schedule.timespan) {
                            delete schedule.active
                            delete schedule.currentStartTime
                        } else {
                            schedule.active = true
                            schedule.currentStartTime = now
                        }
                    } else {
                        const nextStartDate = schedule?.primaryTask?.nextDate || new Date()

                        // handle solar timespan schedules where solar event is end time
                        if (task.node_expressionType === 'cron' && schedule.scheduleType === 'solar') {
                            const { payload: endPayload, payloadType: endPayloadType } = getPayloadAndType(schedule, 'endPayloadValue', false)

                            const solarCmd = {
                                command: 'add',
                                id: schedule.endTaskId || RED.util.generateId(),
                                scheduleId: schedule.id,
                                topic: schedule.topic,
                                expressionType: 'solar',
                                solarType: 'selected',
                                solarEvents: schedule.solarEvent,
                                solarDays: null,
                                date: nextStartDate,
                                offset: schedule.offset,
                                locationType: 'fixed',
                                payload: endPayload,
                                payloadType: endPayloadType,
                                dontStartTheTask: !schedule.enabled,
                                endSchedule: true,
                                limit: 1
                            }
                            const description = generateSolarDescription(node, solarCmd)
                            if (description && description.lastEventTimeOffset) {
                                // check if the last solar event time is before the primary task's last event time in which case we add an upcoming end task
                                if (schedule?.primaryTask?.lastDate > description.lastEventTimeOffset) {
                                    schedule.active = true
                                    schedule.currentStartTime = now
                                    updateTask(node, solarCmd, null)
                                } else {
                                    schedule.active = false
                                    schedule.currentStartTime = null
                                }
                            }
                        }
                        if (schedule.timespan === 'duration') {
                            // If timespan is duration, create a new task for the end of the schedule
                            const duration = schedule.duration * 60 * 1000

                            // Convert nextEvent to timestamp, add duration, and create new Date object with today's date in UTC
                            const nextEndDate = new Date(nextStartDate.getTime() + duration)

                            // Check if newDateUTC is in the future and then create task
                            if (nextEndDate > now) {
                                const { payload: endPayload, payloadType: endPayloadType } = getPayloadAndType(schedule, 'endPayloadValue', false)

                                // create new end task
                                const endCmd = {
                                    command: 'add',
                                    id: schedule.endTaskId || RED.util.generateId(),
                                    scheduleId: schedule.id,
                                    topic: task.node_topic,
                                    expression: nextEndDate,
                                    payload: endPayload,
                                    type: endPayloadType,
                                    dontStartTheTask: !schedule.enabled,
                                    endSchedule: true,
                                    limit: 1
                                }

                                updateTask(node, endCmd, null)
                            }
                        } else if (schedule.timespan === 'time') {
                            let nextEndDate = null

                            if (isValidDateObject(schedule?.primaryTask?.lastDate)) {
                                const nextEndTimeOccurrence = getNextTimeOccurrence(node, nextStartDate, schedule.solarEventTimespanTime || schedule.endTime)
                                // check if end task is already completed
                                if (now < nextEndTimeOccurrence) {
                                    nextEndDate = nextEndTimeOccurrence
                                }
                            }

                            if (nextEndDate) {
                                const { payload: endPayload, payloadType: endPayloadType } = getPayloadAndType(schedule, 'endPayloadValue', false)

                                // create new end task
                                const endCmd = {
                                    command: 'add',
                                    id: schedule.endTaskId || RED.util.generateId(),
                                    scheduleId: schedule.id,
                                    topic: task.node_topic,
                                    expression: nextEndDate,
                                    payload: endPayload,
                                    type: endPayloadType,
                                    dontStartTheTask: !schedule.enabled,
                                    endSchedule: true,
                                    limit: 1
                                }

                                updateTask(node, endCmd, null)
                            }
                        } else if (schedule.timespan === 'solar') {
                            // If timespan is solar, create a new task for the end of the schedule
                            const { payload: endPayload, payloadType: endPayloadType } = getPayloadAndType(schedule, 'endPayloadValue', false)

                            // create new end task
                            const endCmd = {
                                command: 'add',
                                id: schedule.endTaskId || RED.util.generateId(),
                                scheduleId: schedule.id,
                                topic: task.node_topic,
                                expressionType: 'solar',
                                solarType: 'selected',
                                solarEvents: schedule.solarEventEnd,
                                solarDays: null,
                                date: nextStartDate,
                                offset: schedule.offsetEnd,
                                locationType: 'fixed',
                                payload: endPayload,
                                payloadType: endPayloadType,
                                dontStartTheTask: !schedule.enabled,
                                endSchedule: true,
                                limit: 1
                            }

                            updateTask(node, endCmd, null)
                        }

                        schedule.active = false
                        schedule.currentStartTime = null
                    }
                    updateSchedule(node, schedule)

                    if (isTaskFinished(task)) {
                        if (task?.selfRenew) {
                            process.nextTick(async function () {
                                if (schedule) {
                                    const cmd = generateTaskCmd(schedule)
                                    await updateTask(node, cmd, null)
                                }
                            })
                        } else {
                            process.nextTick(function () {
                                // using nextTick is a work around for an issue (#3) in cronosjs where the job restarts itself after this event handler has exited
                                task.stop()
                                updateNextStatus(node)
                            })
                        }
                        return
                    }
                    task.node_count = task.node_count + 1// ++ stops at 2147483647
                    sendMsg(node, task, timestamp)
                    process.nextTick(async function () {
                        if (task.node_expressionType === 'solar') {
                            await updateTask(node, task.node_opt, null)
                            schedule = updateScheduleNextStatus(node, schedule)
                            updateSchedule(node, schedule)
                        }
                        if (
                            schedule.scheduleType === 'time' &&
                            ['hourly', 'minutes'].includes(schedule.period) &&
                            !isCronCompatible(
                                schedule.period === 'hourly' ? schedule.hourlyInterval : schedule.minutesInterval,
                                schedule.period === 'hourly' ? 'hour' : 'minute'
                            )
                        ) {
                            if (!schedule.primaryTask?.nextDates?.length || schedule.primaryTask?.nextDates?.length <= 1) {
                                const cmd = generateTaskCmd(schedule)
                                await updateTask(node, cmd, null)
                            }
                        }
                    })
                }
            })
                .on('ended', () => {
                    node.debug(`ended '${task.name}' ~ '${task.node_topic}'`)
                    updateNextStatus(node)
                })
                .on('started', () => {
                    let schedule = getScheduleById(node, task.scheduleId)
                    if (schedule) {
                        schedule.enabled = true

                        const now = new Date()
                        schedule = updateScheduleNextStatus(node, schedule)
                        node.debug(`started '${task.name}' ~ '${task.node_topic}'`)
                        process.nextTick(function () {
                            updateNextStatus(node)
                        })

                        if (task.primary) {
                            // no timespan schedule
                            if (schedule.timespan === false) {
                                delete schedule.active
                                delete schedule.currentStartTime
                            }

                            // handle solar timespan schedules where solar event is end time
                            if (task.node_expressionType === 'cron' && schedule.scheduleType === 'solar') {
                                const { payload: endPayload, payloadType: endPayloadType } = getPayloadAndType(schedule, 'endPayloadValue', false)

                                const solarCmd = {
                                    command: 'add',
                                    id: schedule.endTaskId || RED.util.generateId(),
                                    scheduleId: schedule.id,
                                    topic: schedule.topic,
                                    expressionType: 'solar',
                                    solarType: 'selected',
                                    solarEvents: schedule.solarEvent,
                                    solarDays: null,
                                    offset: schedule.offset,
                                    locationType: 'fixed',
                                    payload: endPayload,
                                    payloadType: endPayloadType,
                                    dontStartTheTask: !schedule.enabled,
                                    endSchedule: true,
                                    limit: 1
                                }
                                const description = generateSolarDescription(node, solarCmd)
                                if (description && description.lastEventTimeOffset) {
                                    // check if the last solar event time is before the primary task's last event time in which case we add an upcoming end task
                                    if (schedule?.primaryTask?.lastDate > description.lastEventTimeOffset) {
                                        schedule.active = true
                                        schedule.currentStartTime = schedule?.primaryTask?.lastDate
                                        updateTask(node, solarCmd, null)
                                    } else {
                                        schedule.active = false
                                        schedule.currentStartTime = null
                                        solarCmd.date = new Date(schedule?.primaryTask?.nextDate)
                                        updateTask(node, solarCmd, null)
                                    }
                                }
                            } else if (schedule.timespan === 'duration') {
                                // If timespan is duration, create a new task for the end of the schedule
                                const duration = schedule.duration * 60 * 1000

                                // Convert nextEvent to timestamp, add duration, and create new Date object with today's date in UTC
                                let nextEndDate = new Date(new Date(schedule?.primaryTask?.lastDate).getTime() + duration)

                                if (nextEndDate > now) {
                                    schedule.active = true
                                    schedule.currentStartTime = schedule?.primaryTask?.lastDate
                                } else {
                                    nextEndDate = new Date(new Date(schedule?.primaryTask?.nextDate).getTime() + duration)
                                    schedule.active = false
                                    schedule.currentStartTime = null
                                }

                                // Check if newDateUTC is in the future and then create task
                                const { payload: endPayload, payloadType: endPayloadType } = getPayloadAndType(schedule, 'endPayloadValue', false)

                                // create new end task
                                const endCmd = {
                                    command: 'add',
                                    id: schedule.endTaskId || RED.util.generateId(),
                                    scheduleId: schedule.id,
                                    topic: task.node_topic,
                                    expression: nextEndDate,
                                    payload: endPayload,
                                    type: endPayloadType,
                                    dontStartTheTask: !schedule.enabled,
                                    endSchedule: true,
                                    limit: 1
                                }

                                updateTask(node, endCmd, null)
                            } else if (schedule.timespan === 'time') {
                                let nextEndDate = null

                                if (isValidDateObject(schedule?.primaryTask?.lastDate)) {
                                    const nextEndTimeOccurrence = getNextTimeOccurrence(node, schedule?.primaryTask?.lastDate, schedule.solarEventTimespanTime || schedule.endTime)
                                    // check if end task is already completed
                                    if (now < nextEndTimeOccurrence) {
                                        nextEndDate = nextEndTimeOccurrence
                                        if (schedule.primaryTask.nextDate > nextEndDate) {
                                            schedule.active = true
                                            schedule.currentStartTime = schedule?.primaryTask?.lastDate
                                        } else {
                                            schedule.active = false
                                            schedule.currentStartTime = null
                                        }
                                    }
                                }

                                if (!nextEndDate) {
                                    nextEndDate = getNextTimeOccurrence(node, schedule?.primaryTask?.nextDate, schedule.solarEventTimespanTime || schedule.endTime)
                                    schedule.active = false
                                    schedule.currentStartTime = null
                                }
                                if (nextEndDate) {
                                    const { payload: endPayload, payloadType: endPayloadType } = getPayloadAndType(schedule, 'endPayloadValue', false)

                                    // create new end task
                                    const endCmd = {
                                        command: 'add',
                                        id: schedule.endTaskId || RED.util.generateId(),
                                        scheduleId: schedule.id,
                                        topic: task.node_topic,
                                        expression: nextEndDate,
                                        payload: endPayload,
                                        type: endPayloadType,
                                        dontStartTheTask: !schedule.enabled,
                                        endSchedule: true,
                                        limit: 1
                                    }

                                    updateTask(node, endCmd, null)
                                } else {
                                    schedule.active = false
                                    schedule.currentStartTime = null
                                }
                            } else if (schedule.timespan === 'solar') {
                                // If timespan is solar, create a new task for the end of the schedule
                                const { payload: endPayload, payloadType: endPayloadType } = getPayloadAndType(schedule, 'endPayloadValue', false)

                                // create new end task
                                const endCmd = {
                                    command: 'add',
                                    id: schedule.endTaskId || RED.util.generateId(),
                                    scheduleId: schedule.id,
                                    topic: task.node_topic,
                                    expressionType: 'solar',
                                    solarType: 'selected',
                                    solarEvents: schedule.solarEventEnd,
                                    solarDays: null,
                                    date: now,
                                    offset: schedule.offsetEnd,
                                    locationType: 'fixed',
                                    payload: endPayload,
                                    payloadType: endPayloadType,
                                    dontStartTheTask: !schedule.enabled,
                                    endSchedule: true,
                                    limit: 1
                                }

                                updateTask(node, endCmd, null)
                            }
                        } else {
                            // handle end schedule starts
                        }
                        schedule = updateScheduleNextStatus(node, schedule)
                        updateSchedule(node, schedule)
                    }
                })
                .on('stopped', () => {
                    node.debug(`stopped '${task.name}' ~ '${task.node_topic}'`)
                    updateNextStatus(node)
                    if (task.primary === true) {
                        let schedule = getScheduleById(node, task.scheduleId)
                        if (schedule) {
                            schedule.enabled = false

                            schedule = updateScheduleNextStatus(node, schedule)

                            if (schedule.timespan === 'duration' || schedule.timespan === 'time' || schedule.timespan === 'solar') {
                                schedule.active = false
                                schedule.currentStartTime = null
                            }
                            updateSchedule(node, schedule)
                        }
                    }
                })

            task.stop()// prevent bug where calling start without first calling stop causes events to bunch up
            const schedule = getScheduleById(node, task.scheduleId)
            if (schedule) {
                // Initialize primaryTask and endTask if they don't exist
                if (!schedule.primaryTask) {
                    schedule.primaryTask = {}
                }
                if (!schedule.endTask) {
                    schedule.endTask = {}
                }

                // Update the task within the schedule
                if (task.primary === true) {
                    schedule.primaryTask.task = task
                } else {
                    schedule.endTaskId = task.id
                    schedule.endTask.task = task
                }
                updateSchedule(node, schedule)
            }

            if (opt.dontStartTheTask !== true) {
                task.start()
            }

            return task
        }

        function requestSerialisation () {
            if (node.serialisationRequestBusy || node.postponeSerialisation) {
                return
            }

            node.queuedSerialisationRequest = Date.now()
        }

        async function serialise () {
            let filePath = ''
            try {
                if (!FSAvailable && node.storeName === 'local_file_system') {
                    return
                }
                const schedules = node.schedules || []
                const exportedSchedules = schedules
                    .filter((item) => !item.isStatic) // Exclude items with isStatic === true
                    .map((item) => exportSchedule(item))

                const scheduleStates = {
                    version: 2,
                    schedules: exportedSchedules
                }
                if (node.storeName === 'NONE') {
                    return
                }

                if (node.storeName === 'local_file_system') {
                    try {
                        filePath = getPersistFilePath()
                        const fileData = JSON.stringify(scheduleStates)
                        fs.writeFileSync(filePath, fileData)
                    } catch (err) {
                        node.error(`An error occurred while writing state to file '${filePath}' - (${err.message})`)
                    }
                } else {
                    const contextKey = 'state'
                    const storeName = node.storeName || 'default'
                    if (!contextAvailable || STORE_NAMES.indexOf(storeName) === -1) {
                        return
                    }
                    await contextSet(node.context(), contextKey, scheduleStates, storeName)
                }

                /* if(!dynNodesExp || !dynNodesExp.length){
                            //FUTURE TODO: Sanity check before deletion
                            //and only if someone asks for it :)
                            //other wise, file clean up is a manual task
                            fs.unlinkSync(filePath);
                            return;
                        } */
            } catch (e) {
                node.error(`Error saving persistence data. ${e.message}`)
            } finally {
                node.queuedSerialisationRequest = null
            }
        }

        async function deserialise () {
            let filePath = ''
            const sendSchedules = () => {
                const uiSchedules = base.stores.state.getProperty(node.id, 'schedules') || []
                const msg = { ui_update: { schedules: uiSchedules }, event: 'init' }
                base.emit('msg-input:' + node.id, msg, node)
            }
            try {
                if (!FSAvailable && node.storeName === 'local_file_system') {
                    return
                }

                const restoreState = async (state) => {
                    if (!state) {
                        sendSchedules()
                        return // nothing to add
                    }

                    if (state.version === 2) {
                        const stateSchedules = state.schedules || []
                        const schedules = node.schedules || []
                        const cmds = []
                        stateSchedules.forEach(schedule => {
                            // Generate ID if it doesn't exist
                            if (schedule.id === undefined || schedule.id === null) {
                                schedule.id = RED.util.generateId()
                            }

                            // Convert schedule.days and schedule.solarDays to lowercase
                            if (schedule.days) {
                                schedule.days = schedule.days.map(day => {
                                    return typeof day === 'string' ? day.toLowerCase() : day
                                })
                            }

                            if (schedule.solarDays) {
                                schedule.solarDays = schedule.solarDays.map(day => {
                                    return typeof day === 'string' ? day.toLowerCase() : day
                                })
                            }

                            const result = validateCustomPayload(schedule)
                            if (result.valid === false) {
                                schedule.invalid = true
                                schedule.enabled = false
                                node.warn(result.message)
                            }

                            // Generate task command
                            const cmd = generateTaskCmd(schedule)
                            if (Array.isArray(cmd)) {
                                cmd.forEach(c => {
                                    if (c.primary) schedule.primaryTaskId = c.id
                                    if (c.endSchedule) schedule.endTaskId = c.id
                                    cmds.push(c)
                                })
                            } else if (cmd) {
                                if (cmd.primary) {
                                    // Set schedule.primaryTaskId to id
                                    schedule.primaryTaskId = cmd.id
                                }
                                cmds.push(cmd)
                            }

                            // Get or add the schedule, no need t delete task sunce not started yet
                            const nodeSchedule = getSchedule(node, schedule.id)
                            if (nodeSchedule) {
                                // Directly overwrite nodeSchedule object
                                node.schedules[node.schedules.indexOf(nodeSchedule)] = schedule
                            } else {
                                schedules.push(schedule) // Add new schedule
                            }
                        })

                        if (cmds.length > 0) {
                            try {
                                await updateTask(node, cmds, null)
                                updateNextStatus(node, true)

                                // get status
                                schedules.forEach(msgSchedule => {
                                    let schedule = getSchedule(node, msgSchedule.id)

                                    if (schedule) {
                                        schedule = updateScheduleNextStatus(node, schedule, false)
                                    } else {
                                        console.log('Schedule not found in schedules')
                                    }
                                })
                            } catch (error) {
                                console.error(error)
                            }
                        }
                    } else {
                        if (state.dynamicSchedules && state.dynamicSchedules.length) {
                            // eslint-disable-next-line prefer-const
                            const schedules = node.schedules || []
                            const cmds = []

                            for (let iOpt = 0; iOpt < state.dynamicSchedules.length; iOpt++) {
                                const opt = state.dynamicSchedules[iOpt]
                                opt.name = opt.name || opt.topic
                                const schedule = opt?.schedule
                                if (schedule) {
                                    // Generate ID if it doesn't exist
                                    if (schedule.id === undefined || schedule.id === null) {
                                        schedule.id = RED.util.generateId()
                                    }

                                    // Convert hasDuration to timespan
                                    if (schedule.hasDuration !== undefined) {
                                        if (schedule.hasDuration === true) {
                                            schedule.timespan = 'duration'
                                        } else if (schedule.hasDuration === false) {
                                            schedule.timespan = false
                                        } else if (schedule.hasDuration === 'time') {
                                            schedule.timespan = 'time'
                                        }
                                    }

                                    // Convert hasEndTime to timespan
                                    if (schedule.hasEndTime !== undefined) {
                                        if (schedule.hasEndTime === true) {
                                            schedule.timespan = 'time'
                                        } else if (schedule.hasEndTime === false) {
                                            schedule.timespan = false
                                        }
                                    }
                                    if (!schedule.timespan) {
                                        schedule.timespan = false
                                    }

                                    // Generate task command
                                    const cmd = generateTaskCmd(schedule)
                                    if (Array.isArray(cmd)) {
                                        cmd.forEach(c => {
                                            if (c.primary) schedule.primaryTaskId = c.id
                                            if (c.endSchedule) schedule.endTaskId = c.id
                                            cmds.push(c)
                                        })
                                    } else if (cmd) {
                                        // Check if primary is true
                                        if (cmd.primary) {
                                            // Set schedule.primaryTaskId to id
                                            schedule.primaryTaskId = cmd.id
                                        }
                                        cmds.push(cmd)
                                    }

                                    // Get or add the schedule
                                    const nodeSchedule = getSchedule(node, schedule.id)
                                    if (nodeSchedule) {
                                        // Directly overwrite nodeSchedule object
                                        node.schedules[node.schedules.indexOf(nodeSchedule)] = schedule
                                    } else {
                                        schedules.push(schedule) // Add new schedule
                                    }
                                }
                            }
                            if (cmds.length > 0) {
                                try {
                                    await updateTask(node, cmds, null)
                                    updateNextStatus(node, true)

                                    // get status
                                    schedules.forEach(msgSchedule => {
                                        let schedule = getSchedule(node, msgSchedule.id)

                                        if (schedule) {
                                            schedule = updateScheduleNextStatus(node, schedule, false)
                                        } else {
                                            console.log('Schedule not found in schedules')
                                        }
                                    })
                                } catch (error) {
                                    console.error(error)
                                }
                            }
                            requestSerialisation() // upgrade persistence
                        }
                    }
                    const uiSchedules = updateUISchedules(node)
                    const m = { ui_update: { uiSchedules }, event: 'load' }
                    base.emit('msg-input:' + node.id, m, node)
                    updateNodeNextInfo(node)
                }
                if (node.storeName === 'NONE') {
                    sendSchedules()
                    return
                }
                if (node.storeName === 'local_file_system') {
                    filePath = getPersistFilePath()
                    if (fs.existsSync(filePath)) {
                        const fileData = fs.readFileSync(filePath)

                        const data = JSON.parse(fileData)
                        const state = data?.state || data
                        await restoreState(state)
                    } else {
                        sendSchedules()
                        RED.log.debug(`scheduler: no persistence data found for node '${node.id}'.`)
                    }
                } else {
                    // use context
                    const storeName = node.storeName || 'default'
                    const contextKey = 'state'
                    if (!contextAvailable || !STORE_NAMES.indexOf(storeName)) {
                        sendSchedules()
                        return
                    }
                    const state = await contextGet(node.context(), contextKey, storeName)
                    await restoreState(state)
                }
            } catch (error) {
                sendSchedules()
                node.error(`scheduler: Error loading persistence data '${filePath}'. ${error.message}`)
            }
        }

        function getPersistFilePath () {
            const fileName = `node-${node.id}.json`
            return path.join(persistPath, fileName)
        }

        function updateNextStatus (node, force) {
            const now = new Date()
            updateNodeNextInfo(node, now)
            if (node.statusUpdatePending === true) {
                if (force) {
                    node.statusUpdatePending = false
                } else {
                    return
                }
            }

            if (node.schedules && node.schedules.length) {
                const indicator = node.nextIndicator || 'dot'
                if (node.nextDate) {
                    const d = formatShortDateTimeWithTZ(node.nextDate, node.timeZone, node.use24HourFormat, node.locale) || 'Never'
                    node.status({ fill: 'blue', shape: indicator, text: (node.nextEvent || 'Next') + ': ' + d })
                } else if (node.schedules && node.schedules.length) {
                    node.status({ fill: 'grey', shape: indicator, text: 'All stopped' })
                } else {
                    node.status({}) // no tasks
                }
            } else {
                node.status({})
            }
        }

        /**
             * Retrieves the next schedule from a node's schedules.
             *
             * This function iterates over the schedules of a given node to find the
             * schedule with the closest upcoming date. It returns the schedule with
             * the nearest future date compared to the current time.
             *
             * @param {Object} node - The node containing schedules to evaluate.
             * @returns {Object|null} The schedule with the closest future date, or null if no valid schedule is found.
             */
        function getNextSchedule (node) {
            if (node && node.schedules && Array.isArray(node.schedules)) {
                const now = new Date()

                let closestSchedule = null
                let closestTimeDifference = Infinity

                node.schedules.forEach(schedule => {
                    if (schedule && schedule.primaryTask && schedule.primaryTask.nextDate) {
                        const nextDate = new Date(schedule.primaryTask.nextDate)

                        if (nextDate > now) {
                            const timeDifference = nextDate - now

                            if (timeDifference < closestTimeDifference) {
                                closestTimeDifference = timeDifference
                                closestSchedule = schedule
                            }
                        }
                    }
                })

                return closestSchedule
            }

            return null
        }

        /**
             * Retrieves the next scheduled task from a node's schedule list.
             *
             * This function checks both primary and end tasks within each schedule
             * to determine the closest upcoming task based on the current time.
             *
             * @param {Object} node - The node containing schedules to evaluate.
             * @returns {Object|null} An object containing the closest schedule and its type ('primary' or 'end'),
             * or null if no valid schedules are found.
             */
        function getNextScheduleTask (node) {
            if (node.schedules && Array.isArray(node.schedules)) {
                const now = new Date()
                let closestSchedule = null
                let closestTimeDifference = Infinity
                let taskType = ''

                node.schedules.forEach(schedule => {
                    if (schedule.primaryTask && schedule.primaryTask.nextDate) {
                        const primaryTaskNextDate = new Date(schedule.primaryTask.nextDate)

                        if (primaryTaskNextDate > now) {
                            const primaryTaskTimeDifference = primaryTaskNextDate - now

                            if (primaryTaskTimeDifference < closestTimeDifference) {
                                closestTimeDifference = primaryTaskTimeDifference
                                closestSchedule = schedule
                                taskType = 'primary'
                            }
                        }
                    }

                    if (schedule.endTask && schedule.endTask.nextDate) {
                        const endTaskNextDate = new Date(schedule.endTask.nextDate)

                        if (endTaskNextDate > now) {
                            const endTaskTimeDifference = endTaskNextDate - now

                            if (endTaskTimeDifference < closestTimeDifference) {
                                closestTimeDifference = endTaskTimeDifference
                                closestSchedule = schedule
                                taskType = 'end'
                            }
                        }
                    }
                })

                return { schedule: closestSchedule, type: taskType }
            }
            return null
        }

        function generateTaskCmd (schedule) {
            if (!schedule) {
                console.error('Schedule is undefined or null')
                return null
            }

            let cmd = null

            // Determine payloads for start command
            const { payload: startPayload, payloadType: startPayloadType } =
                getPayloadAndType(schedule, 'payloadValue', true)

            // A helper to create a command object and apply default options.
            function createCommand (expression, expressionType, additionalOptions = {}) {
                const command = {
                    command: 'add',
                    scheduleId: schedule.id,
                    // Check if either primaryTask or primaryTaskId exists
                    id:
                        (schedule.primaryTask && schedule.primaryTask.id) ||
                        schedule.primaryTaskId ||
                        RED.util.generateId(),
                    topic: schedule.topic,
                    expression,
                    expressionType,
                    payload: startPayload,
                    payloadType: startPayloadType,
                    dontStartTheTask: !schedule.enabled,
                    // If "isDynamic" is true or if "isStatic" is false
                    isDynamic: schedule.isDynamic || !schedule.isStatic,
                    isStatic: schedule.isStatic,
                    primary: true,
                    ...additionalOptions
                }
                applyOptionDefaults(node, command)
                return command
            }

            // ------------------ SCHEDULE TYPE: TIME ------------------
            if (schedule.scheduleType === 'time') {
                let startCronExpression = ''
                let expressionType = 'cron'
                let selfRenew = false

                switch (schedule.period) {
                case 'minutes': {
                    if (isCronCompatible(schedule.minutesInterval, 'minute')) {
                        startCronExpression = `*/${schedule.minutesInterval} * * * *`
                    } else {
                        expressionType = 'dates'
                        selfRenew = true
                        startCronExpression = generateDateSequence(schedule.minutesInterval, 'minute', 'both', 10)
                    }
                    // If timespan is not duration then remove any end task.
                    if (schedule.timespan !== 'duration') {
                        removeEndTask(node, schedule.id)
                    }
                    break
                }
                case 'hourly': {
                    // (Note: corrected to use hourlyInterval and 'hour' check)
                    if (isCronCompatible(schedule.hourlyInterval, 'hour')) {
                        startCronExpression = `0 */${schedule.hourlyInterval} * * *`
                    } else {
                        expressionType = 'dates'
                        selfRenew = true
                        startCronExpression = generateDateSequence(schedule.hourlyInterval, 'hour', 'both', 10)
                    }
                    if (schedule.timespan !== 'duration') {
                        removeEndTask(node, schedule.id)
                    }
                    break
                }
                case 'daily': {
                    const dailyDays = schedule.days.length === 7
                        ? '*'
                        : schedule.days.map((day) => day.substring(0, 3).toUpperCase()).join(',')
                    const [hour, minute] = schedule.time.split(':')
                    startCronExpression = `0 ${minute} ${hour} * * ${dailyDays}`
                    if (schedule.timespan !== 'time') {
                        removeEndTask(node, schedule.id)
                    }
                    break
                }
                case 'weekly': {
                    const weeklyDays = schedule.days.map((day) => day.substring(0, 3).toUpperCase()).join(',')
                    const [hour, minute] = schedule.time.split(':')
                    startCronExpression = `0 ${minute} ${hour} * * ${weeklyDays}`
                    if (schedule.timespan !== 'time') {
                        removeEndTask(node, schedule.id)
                    }
                    break
                }
                case 'monthly': {
                    const hasLastDay = schedule.days.includes('Last')
                    const otherDays = schedule.days.filter((day) => day !== 'Last').join(',')
                    const monthlyDays = hasLastDay ? (otherDays ? `${otherDays},L` : 'L') : otherDays
                    const [hour, minute] = schedule.time.split(':')
                    startCronExpression = `0 ${minute} ${hour} ${monthlyDays} * *`
                    if (schedule.timespan !== 'time') {
                        removeEndTask(node, schedule.id)
                    }
                    break
                }
                case 'yearly': {
                    const [hour, minute] = schedule.time.split(':')
                    startCronExpression = `0 ${minute} ${hour} ${schedule.days} ${schedule.month.substring(0, 3).toUpperCase()} *`
                    if (schedule.timespan !== 'time') {
                        removeEndTask(node, schedule.id)
                    }
                    break
                }
                default:
                    // Default to a cron that never triggers.
                    startCronExpression = '0 0 31 2 ? *'
                }

                // Construct the start command if we have a cron expression.
                if (startCronExpression) {
                    const startCmd = createCommand(startCronExpression, expressionType, {
                        ...(selfRenew ? { selfRenew } : {})
                    })

                    // Generate a description.
                    let description = ''
                    if (expressionType === 'dates' && (schedule.period === 'minutes' || schedule.period === 'hourly')) {
                        // Use an interval description for minute or hourly schedules.
                        const interval = schedule.period === 'hourly' ? schedule.hourlyInterval : schedule.minutesInterval
                        const unit = schedule.period === 'hourly' ? 'hour' : 'minute'
                        description = generateIntervalDescription(node, interval, unit)
                    } else {
                        description = generateDescription(node, startCmd).description
                    }
                    schedule.description = abbreviateDays(description)
                    cmd = startCmd
                } else {
                    console.error('Invalid startCronExpression', startCronExpression)
                }
            } else if (schedule.scheduleType === 'solar') {
                // ------------------ SCHEDULE TYPE: SOLAR ------------------

                // When timespan is false, remove any existing end task.
                if (schedule.timespan === false) {
                    removeEndTask(node, schedule.id)
                }
                if (schedule.timespan === false || schedule.timespan === 'duration' || schedule.solarEventStart === true) {
                    const solarCmd = createCommand(null, 'solar', {
                        solarType: schedule.solarType || 'selected',
                        solarEvents: schedule.solarEvent || schedule.solarEvents,
                        solarDays: schedule.solarDays || null,
                        offset: schedule.offset,
                        locationType: 'fixed'
                    })
                    schedule.description = generateSolarDescription(node, solarCmd).description
                    cmd = solarCmd
                } else if (schedule.timespan === 'solar') {
                    // Start Command
                    const startCmd = createCommand(null, 'solar', {
                        solarType: schedule.solarType || 'selected',
                        solarEvents: schedule.solarEvent || schedule.solarEvents,
                        solarDays: schedule.solarDays || null,
                        offset: schedule.offset,
                        locationType: 'fixed'
                    })

                    // End Command
                    const { payload: endPayload, payloadType: endPayloadType } =
                        getPayloadAndType(schedule, 'endPayloadValue', false)

                    const endCmd = createCommand(null, 'solar', {
                        id: schedule.endTaskId || RED.util.generateId(),
                        solarType: schedule.solarType || 'selected',
                        solarEvents: schedule.solarEventEnd,
                        solarDays: schedule.solarDays || null,
                        offset: schedule.offsetEnd,
                        locationType: 'fixed',
                        payload: endPayload,
                        payloadType: endPayloadType,
                        primary: false,
                        endSchedule: true,
                        // Override defaults applied by createCommand that assume primary
                        command: 'add'
                    })
                    // Ensure primary is false (createCommand sets it unique if we don't override)
                    // Actually createCommand sets primary: true. We need to override it.
                    endCmd.primary = false

                    schedule.description = generateSolarDescription(node, startCmd).description + ' - ' + generateSolarDescription(node, endCmd).description

                    // Return both
                    return [startCmd, endCmd]
                } else if (
                    schedule.timespan === 'time' &&
                    schedule.solarEventTimespanTime &&
                    schedule.solarEventStart === false
                ) {
                    // Create a solar time command
                    const dailyDaysOfWeek =
                        !schedule.solarDays || schedule.solarDays.length === 7
                            ? '*'
                            : schedule.solarDays.map((day) => day.substring(0, 3).toUpperCase()).join(',')
                    const timeParts = schedule.solarEventTimespanTime.split(':')
                    const timeCronExpression = `0 ${timeParts[1]} ${timeParts[0]} * * ${dailyDaysOfWeek}`
                    const timeCmd = createCommand(timeCronExpression, 'cron', {
                        solarTimespanSchedule: true,
                        solarEventStart: schedule.solarEventStart
                    })
                    const description = generateDescription(node, timeCmd).description
                    schedule.description = abbreviateDays(description)
                    cmd = timeCmd
                }
            } else if (schedule.scheduleType === 'cron') {
                // ------------------ SCHEDULE TYPE: CRON ------------------

                if (schedule.startCronExpression) {
                    // Use createCommand for a cron command.
                    const cronCmd = createCommand(schedule.startCronExpression, 'cron')
                    const description = generateDescription(node, cronCmd).description
                    schedule.description = abbreviateDays(description)
                    cmd = cronCmd
                } else {
                    console.error('Invalid startCronExpression', schedule.startCronExpression)
                }
                if (schedule.timespan === false) {
                    removeEndTask(node, schedule.id)
                }
            } else if (schedule.scheduleType === 'dates') {
                // ------------------ SCHEDULE TYPE: DATES ------------------

                // Construct the dates command manually.
                const datesCmd = {
                    command: 'add',
                    scheduleId: schedule.id,
                    id:
                        (schedule.primaryTask && schedule.primaryTask.id) ||
                        schedule.primaryTaskId ||
                        RED.util.generateId(),
                    topic: schedule.topic,
                    expression: schedule.expression,
                    expressionType: 'dates',
                    payload: startPayload,
                    payloadType: schedule.payloadType || startPayloadType,
                    dontStartTheTask: !schedule.enabled,
                    isDynamic: schedule.isDynamic || !schedule.isStatic,
                    isStatic: schedule.isStatic,
                    primary: true
                }
                applyOptionDefaults(node, datesCmd)
                const description = generateDescription(node, datesCmd).description
                schedule.description = abbreviateDays(description)
                cmd = datesCmd
                if (schedule.timespan === false) {
                    removeEndTask(node, schedule.id)
                }
            }

            return cmd
        }

        /**
             * Generates an array of messages to be sent to the specified output pin.
             *
             * @param {Object} node - The node object containing configuration details.
             * @param {Object} msg - The message object to be sent.
             * @param {string} type - The type of message, which can be 'static', 'dynamic', or 'command-response'.
             * @param {number} index - The index of the output pin, used when fan-out is enabled.
             * @returns {Array} An array with the message placed at the appropriate index, based on the node configuration.
             */
        function generateSendMsg (node, msg, type, index) {
            const outputCount = node.outputs
            const fanOut = node.fanOut
            const hasScheduleOutputPin = !!((node.commandResponseMsgOutput === 'output2' || fanOut))
            let outputPinIndex = 0
            const cmdOutputPin = 0
            if (fanOut) {
                if (index > -1) {
                    outputPinIndex = index + 1
                } else {
                    outputPinIndex = 0
                }
            }
            if (!fanOut && hasScheduleOutputPin) {
                outputPinIndex = 1
            }

            let idx = 0
            switch (type) {
            case 'static':
                idx = outputPinIndex
                break
            case 'dynamic':
                idx = outputPinIndex
                break
            case 'command-response':
                idx = cmdOutputPin
                break
            }
            const arr = Array(outputCount || (idx + 1))
            arr.fill(null)
            arr[idx] = msg
            return arr
        }

        // A helper to test time strings in HH:MM format (24h)
        function isValidTimeFormat (timeStr) {
            const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/
            return timePattern.test(timeStr)
        }

        // Helper to validate timespan rules for "time" schedules (daily/weekly/monthly/yearly)
        function validateTimeTimespan (schedule, allowedMessage) {
            if (schedule.timespan === 'time') {
                if (!schedule.time || !isValidTimeFormat(schedule.time)) {
                    return { valid: false, message: RED._('ui-scheduler.error.startTimeInvalid') }
                }
                if (!schedule.endTime || !isValidTimeFormat(schedule.endTime)) {
                    return { valid: false, message: RED._('ui-scheduler.error.endTimeInvalid') }
                }
            } else if (schedule.timespan !== false) {
                return {
                    valid: false,
                    message: RED._('ui-scheduler.error.invalidTimespan', { allowed: allowedMessage })
                }
            }
            return { valid: true }
        }

        // Helper to validate timespan rules for schedules that use duration (minutes, hourly, cron)
        function validateDurationTimespan (schedule, durationErrorMessage) {
            if (schedule.timespan === 'duration') {
                if (typeof schedule.duration !== 'number') {
                    return { valid: false, message: RED._(durationErrorMessage) }
                }
            } else if (schedule.timespan !== false) {
                return {
                    valid: false,
                    message: RED._('ui-scheduler.error.invalidTimespan', { allowed: 'duration or false for minutes/hourly/cron' })
                }
            }
            return { valid: true }
        }

        function validateCustomPayload (schedule) {
            // Check if schedule payloadType is custom and that it exists
            if (schedule.payloadType === 'custom') {
                // Validate the start (or single) payload using parseCustomPayload
                const startPayload = parseCustomPayload(node, schedule.payloadValue)
                if (startPayload === null) {
                    return {
                        valid: false,
                        invalidPayload: 'start',
                        message: RED._('ui-scheduler.error.customOutputRequired', { field: 'start' })
                    }
                }

                // When timespan requires two payloads, validate the end payload
                if (['duration', 'time', 'solar'].includes(schedule.timespan)) {
                    const endPayload = parseCustomPayload(node, schedule.endPayloadValue)
                    if (endPayload === null) {
                        return {
                            valid: false,
                            invalidPayload: 'end',
                            message: RED._('ui-scheduler.error.customOutputRequired', { field: 'end' })
                        }
                    }
                }
            }
            return { valid: true }
        }

        function validateSchedule (schedule) {
            // Assign a default timespan value if none is provided.
            if (schedule.timespan === null || schedule.timespan === undefined) {
                schedule.timespan = false
            }
            // Basic validations
            if (!schedule.name || schedule.name.trim() === '') {
                return { valid: false, message: RED._('ui-scheduler.error.scheduleNameRequired') }
            }
            if (!schedule.topic || !node.topics.includes(schedule.topic)) {
                return { valid: false, message: RED._('ui-scheduler.error.topicInvalid') }
            }
            if (!['time', 'solar', 'cron'].includes(schedule.scheduleType)) {
                return { valid: false, message: RED._('ui-scheduler.error.invalidScheduleType') }
            }

            if (schedule.scheduleType === 'time') {
                // Validate period – must be one of the allowed ones.
                const validPeriods = ['minutes', 'hourly', 'daily', 'weekly', 'monthly', 'yearly']
                if (!schedule.period || !validPeriods.includes(schedule.period)) {
                    return { valid: false, message: RED._('ui-scheduler.error.invalidPeriod') }
                }

                // Daily or weekly validation
                if (['daily', 'weekly'].includes(schedule.period)) {
                    if (!Array.isArray(schedule.days) || schedule.days.length === 0) {
                        return { valid: false, message: RED._('ui-scheduler.error.daysRequiredForPeriod', { period: schedule.period }) }
                    }
                    for (const day of schedule.days) {
                        if (typeof day !== 'string' || !allDaysOfWeek.includes(day)) {
                            return { valid: false, message: RED._('ui-scheduler.error.invalidDay', { day }) }
                        }
                    }
                    const result = validateTimeTimespan(schedule, 'time or false for daily/weekly')
                    if (!result.valid) return result
                } else if (schedule.period === 'monthly') {
                    // Monthly validation
                    if (!Array.isArray(schedule.days) || schedule.days.length === 0) {
                        return { valid: false, message: RED._('ui-scheduler.error.daysRequiredForPeriod', { period: schedule.period }) }
                    }
                    for (const day of schedule.days) {
                        if (typeof day !== 'number' || day < 1 || day > 31) {
                            return { valid: false, message: RED._('ui-scheduler.error.invalidDayForMonthly', { day }) }
                        }
                    }
                    const result = validateTimeTimespan(schedule, 'time or false for monthly')
                    if (!result.valid) return result
                } else if (schedule.period === 'yearly') {
                    // Yearly validation
                    if (schedule.month === undefined || schedule.month === null) {
                        return { valid: false, message: RED._('ui-scheduler.error.monthRequiredForYearly') }
                    }
                    let monthName
                    if (typeof schedule.month === 'string') {
                        if (!months.includes(schedule.month)) {
                            return { valid: false, message: RED._('ui-scheduler.error.invalidMonth') }
                        }
                        monthName = months.indexOf(schedule.month) + 1
                    } else if (typeof schedule.month === 'number') {
                        if (schedule.month < 1 || schedule.month > 12) {
                            return { valid: false, message: RED._('ui-scheduler.error.invalidMonth') }
                        }
                        monthName = schedule.month
                    } else {
                        return { valid: false, message: RED._('ui-scheduler.error.invalidMonth') }
                    }
                    const maxDays = getMaxDaysInMonth(monthName)
                    if (schedule.days < 1 || schedule.days > maxDays) {
                        return { valid: false, message: RED._('ui-scheduler.error.invalidDayForYearly', { max: maxDays }) }
                    }
                    if (typeof schedule.days !== 'number') {
                        return { valid: false, message: RED._('ui-scheduler.error.dayNumberRequiredForYearly') }
                    }
                    const result = validateTimeTimespan(schedule, 'time or false for yearly')
                    if (!result.valid) return result
                } else if (schedule.period === 'minutes') {
                    // Minutes validation
                    if (typeof schedule.minutesInterval !== 'number') {
                        return { valid: false, message: RED._('ui-scheduler.error.minutesIntervalRequired') }
                    }
                    const result = validateDurationTimespan(schedule, 'ui-scheduler.error.minutesDurationRequired')
                    if (!result.valid) return result
                } else if (schedule.period === 'hourly') {
                    // Hourly validation
                    if (typeof schedule.hourlyInterval !== 'number') {
                        return { valid: false, message: RED._('ui-scheduler.error.hourlyIntervalRequired') }
                    }
                    const result = validateDurationTimespan(schedule, 'ui-scheduler.error.hourlyDurationRequired')
                    if (!result.valid) return result
                }
            } else if (schedule.scheduleType === 'solar') {
                if (!node.defaultLocation || node.defaultLocation === '') {
                    return { valid: false, message: RED._('ui-scheduler.error.solarLocationRequired') }
                }
                if (!schedule.solarEvent || !PERMITTED_SOLAR_EVENTS.includes(schedule.solarEvent)) {
                    return { valid: false, message: RED._('ui-scheduler.error.solarEventRequired') }
                }
                if (typeof schedule.offset !== 'number') {
                    return { valid: false, message: RED._('ui-scheduler.error.solarOffsetRequired') }
                }
                if (schedule.timespan === 'duration') {
                    if (typeof schedule.duration !== 'number') {
                        return { valid: false, message: RED._('ui-scheduler.error.solarDurationRequired') }
                    }
                } else if (schedule.timespan === 'time') {
                    if (schedule.solarEventStart === null || typeof schedule.solarEventStart !== 'boolean') {
                        return { valid: false, message: RED._('ui-scheduler.error.solarTimeDefinitionRequired') }
                    }
                    if (!schedule.solarEventTimespanTime || !isValidTimeFormat(schedule.solarEventTimespanTime)) {
                        return { valid: false, message: RED._('ui-scheduler.error.solarTimeRequired') }
                    }
                } else if (schedule.timespan === 'solar') {
                    if (!schedule.solarEventEnd || !PERMITTED_SOLAR_EVENTS.includes(schedule.solarEventEnd)) {
                        return { valid: false, message: RED._('ui-scheduler.error.solarEventEndRequired') }
                    }
                    if (typeof schedule.offsetEnd !== 'number') {
                        return { valid: false, message: RED._('ui-scheduler.error.solarOffsetEndRequired') }
                    }
                } else if (schedule.timespan !== false) {
                    // In solar, timespan must be 'time', 'duration', 'solar', or false.
                    return {
                        valid: false,
                        message: RED._('ui-scheduler.error.invalidTimespan', { allowed: '"time", "duration", "solar", or false for solar' })
                    }
                }
                // Validate solarDays if provided (optional)
                if (schedule.solarDays !== undefined && schedule.solarDays !== null) {
                    if (!Array.isArray(schedule.solarDays)) {
                        return { valid: false, message: RED._('ui-scheduler.error.invalidDay') }
                    }
                    for (const day of schedule.solarDays) {
                        if (typeof day !== 'string' || !allDaysOfWeek.includes(day)) {
                            return { valid: false, message: RED._('ui-scheduler.error.invalidDay', { day }) }
                        }
                    }
                }
            } else if (schedule.scheduleType === 'cron') {
                if (!schedule.cronValue || !isCronLike(schedule.cronValue)) {
                    return { valid: false, message: RED._('ui-scheduler.error.cronValidRequired') }
                }
                const result = validateDurationTimespan(schedule, 'ui-scheduler.error.cronDurationRequired')
                if (!result.valid) return result
            }

            // Validate Payload Type based on timespan existence
            if (schedule.payloadType === null || schedule.payloadType === undefined) {
                return { valid: false, message: RED._('ui-scheduler.error.outputValueRequired') }
            }
            if (schedule.timespan === false) {
                if (![true, false, 'custom'].includes(schedule.payloadType)) {
                    return {
                        valid: false,
                        message: RED._('ui-scheduler.error.invalidPayloadTypeForNoTimespan', {
                            allowed: 'true, false, or custom'
                        })
                    }
                }
            } else if (['duration', 'time', 'solar'].includes(schedule.timespan)) {
                if (!['true_false', 'custom'].includes(schedule.payloadType)) {
                    return {
                        valid: false,
                        message: RED._('ui-scheduler.error.invalidPayloadTypeForTimespan', {
                            allowed: '"true_false" or "custom"'
                        })
                    }
                }
            }
            const result = validateCustomPayload(schedule)
            if (result.valid === false) {
                return { ...result }
            }

            return { valid: true, message: '' }
        }

        function cleanSchedule (schedule) {
            const scheduleId = getScheduleId(node, schedule.name)
            const newSchedule = {

                id: scheduleId,
                name: schedule.name,
                enabled: schedule.enabled,
                topic: schedule.topic,
                scheduleType: schedule.scheduleType
            }

            if (schedule.scheduleType === 'time') {
                newSchedule.period = schedule.period

                if (['daily', 'weekly', 'monthly', 'yearly'].includes(schedule.period)) {
                    newSchedule.time = schedule.time
                    newSchedule.days = schedule.days
                    if (schedule.timespan === 'time') {
                        newSchedule.timespan = schedule.timespan
                        newSchedule.endTime = schedule.endTime
                    } else {
                        newSchedule.timespan = false
                    }
                }

                if (schedule.period === 'yearly') {
                    newSchedule.month = schedule.yearlyMonth
                } else if (schedule.period === 'minutes') {
                    newSchedule.minutesInterval = schedule.minutesInterval
                    if (schedule.timespan === 'duration') {
                        newSchedule.timespan = schedule.timespan
                        newSchedule.duration = schedule.duration
                    } else {
                        newSchedule.timespan = false
                    }
                } else if (schedule.period === 'hourly') {
                    newSchedule.hourlyInterval = schedule.hourlyInterval
                    if (schedule.timespan === 'duration') {
                        newSchedule.timespan = schedule.timespan
                        newSchedule.duration = schedule.duration
                    } else {
                        newSchedule.timespan = false
                    }
                }
            } else if (schedule.scheduleType === 'solar') {
                newSchedule.solarEvent = schedule.solarEvent
                newSchedule.offset = schedule.offset

                if (schedule.timespan === 'duration') {
                    newSchedule.timespan = schedule.timespan
                    newSchedule.duration = schedule.duration
                } else if (schedule.timespan === 'time') {
                    newSchedule.timespan = schedule.timespan
                    newSchedule.solarEventStart = schedule.solarEventStart
                    newSchedule.solarEventTimespanTime = schedule.solarEventTimespanTime
                } else if (schedule.timespan === 'solar') {
                    newSchedule.timespan = schedule.timespan
                    newSchedule.solarEventEnd = schedule.solarEventEnd
                    newSchedule.offsetEnd = schedule.offsetEnd
                } else {
                    newSchedule.timespan = false
                }

                if (
                    schedule.solarDays &&
                    Array.isArray(schedule.solarDays) &&
                    schedule.solarDays.length > 0 &&
                    schedule.solarDays.length < 7
                ) {
                    newSchedule.solarDays = schedule.solarDays
                }
            } else if (schedule.scheduleType === 'cron') {
                newSchedule.startCronExpression = schedule.cronValue
                if (schedule.timespan === 'duration') {
                    newSchedule.timespan = schedule.timespan
                    newSchedule.duration = schedule.duration
                } else {
                    newSchedule.timespan = false
                }
            }
            if (schedule.timespan) {
                newSchedule.payloadType = schedule.payloadType
                if (schedule.payloadType !== 'custom') {
                    newSchedule.payloadValue = true
                    newSchedule.endPayloadValue = false
                } else {
                    newSchedule.payloadValue = parseCustomPayload(node, schedule.payloadValue)
                    newSchedule.endPayloadValue = parseCustomPayload(node, schedule.endPayloadValue)
                }
            } else {
                newSchedule.payloadType = schedule.payloadType
                if (schedule.payloadType !== 'custom' && schedule.payloadType !== 'true_false') {
                    newSchedule.payloadValue = schedule.payloadType
                } else if (schedule.payloadType === 'custom') {
                    newSchedule.payloadValue = parseCustomPayload(node, schedule.payloadValue)
                }
            }
            return newSchedule
        }

        // #region UI Actions

        /**
            * Submits a schedule by processing and updating the node's schedules.
            *
            * @param {Object} msg - The message object containing the payload with schedules.
            * @returns {void}
            *
            * Processes the schedules from the message payload, updates the node's schedules,
            * and emits UI updates. If there are schedule commands, they are handled asynchronously.
            * In case of an error, logs the error and reports it to the node.
            */
        async function submitSchedule (inputSchedule) {
            if (!inputSchedule) return
            if (!Array.isArray(inputSchedule)) inputSchedule = [inputSchedule]
            try {
                const schedules = node.schedules || []
                const scheduleCommands = processSchedules(inputSchedule, schedules)

                updateSchedules(node)
                emitUiUpdate(node, getUiSchedules(node), 'submit')

                if (scheduleCommands.length > 0) {
                    await handleScheduleCommands(scheduleCommands, inputSchedule)
                }

                emitUiUpdate(node, getUiSchedules(node), 'submit_status')
                sendTopicMsg(node, new Date())
            } catch (error) {
                console.error('Error in submitSchedule:', error)
                node.error(error)
            }
        }

        /**
             * Handles schedule commands by updating tasks and schedules.
             *
             * This function processes the given schedule commands by updating the task
             * associated with the schedule and the provided message. It then updates the
             * next status of the node and requests serialization. For each schedule ID
             * in the message payload, it retrieves the corresponding schedule and updates
             * its next status. If a schedule is not found for a given ID, a warning is logged.
             *
             * @param {Object} scheduleCommands - The commands to update the schedule.
             * @param {Object} msg - The message containing the payload with schedule IDs.
             * @throws Will throw an error if processing the schedule commands fails.
             */
        async function handleScheduleCommands (scheduleCommands, inputSchedule) {
            try {
                await updateTask(node, scheduleCommands, inputSchedule)
                updateNextStatus(node, true)
                requestSerialisation()

                inputSchedule.forEach(({ id }) => {
                    let schedule = getSchedule(node, id)
                    if (schedule) {
                        schedule = updateScheduleNextStatus(node, schedule, false)
                    } else {
                        console.warn(`Schedule not found for ID: ${id}`)
                    }
                })
            } catch (error) {
                console.error('Error processing schedule commands:', error)
                throw error // Rethrow the error for upstream handling.
            }
        }

        /**
             * Processes an array of schedule objects, generating commands and updating the schedules list.
             *
             * @param {Array} scheduleArray - An array of schedule objects to be processed.
             * @param {Array} schedules - A list of existing schedules to be updated or appended to.
             * @returns {Array} An array of command objects generated from the schedules.
             */
        function processSchedules (scheduleArray, schedules) {
            const commands = []
            scheduleArray.forEach(schedule => {
                schedule.id = schedule.id ?? RED.util.generateId()
                schedule.isDynamic = schedule.isStatic !== true

                const existingSchedule = getSchedule(node, schedule.id)
                if (existingSchedule) {
                    // delete old schedule and tasks for cleanliness
                    deleteSchedule(node, existingSchedule.id)
                }

                const cmds = generateTaskCmd(schedule)
                if (Array.isArray(cmds)) {
                    cmds.forEach(cmd => {
                        if (cmd.primary) schedule.primaryTaskId = cmd.id
                        if (cmd.endSchedule) schedule.endTaskId = cmd.id
                        commands.push(cmd)
                    })
                } else if (cmds) {
                    if (cmds.primary) schedule.primaryTaskId = cmds.id
                    commands.push(cmds)
                }

                // ensure were working with up to date schedule array
                schedules = node.schedules

                schedules.push(schedule)
            })
            return commands
        }

        /**
             * Emits a UI update event for a specific node.
             *
             * @param {Object} node - The node object for which the UI update is emitted.
             * @param {Array} uiSchedules - An array of UI schedules to be included in the update.
             * @param {string} eventType - The type of event triggering the UI update.
             */
        function emitUiUpdate (node, uiSchedules, eventType) {
            const updateMessage = {
                ui_update: { schedules: uiSchedules },
                event: eventType
            }
            base.emit(`msg-input:${node.id}`, updateMessage, node)
        }

        /**
             * Removes a schedule based on the provided message payload.
             *
             * @param {Object} msg - The message object containing the schedule ID.
             * @param {Object} msg.payload - The payload of the message.
             * @param {string} msg.payload.id - The ID of the schedule to be removed.
             *
             * Logs a warning if no schedule ID is provided. Deletes the schedule,
             * updates the next status, requests serialization, updates the UI schedules,
             * and emits a UI update event.
             */
        function removeSchedule (msg) {
            if (!msg?.payload?.id) {
                console.warn('No schedule ID provided for removal.')
                return
            }

            deleteSchedule(node, msg.payload.id)
            updateNextStatus(node, true)
            requestSerialisation()

            const uiSchedules = updateUISchedules(node)
            emitUiUpdate(node, uiSchedules, 'remove')
            sendTopicMsg(node, new Date())
        }

        /**
             * Toggles the scheduling state of tasks based on the provided message payload.
             *
             * @param {Object} msg - The message object containing scheduling information.
             * @param {Object} msg.payload - The payload of the message.
             * @param {Array|string} msg.payload.names - An array of task names or a single task name to be processed.
             * @param {boolean} msg.payload.enabled - A flag indicating whether to enable or disable the schedule.
             *
             * The function iterates over the task names provided in the payload and either starts or stops
             * the schedule for each task based on the 'enabled' flag. It also updates the next status
             * and requests serialization after processing.
             */
        function setScheduleEnabled (msg) {
            const handleTask = (id, enabled) => {
                enabled ? startSchedule(node, id) : stopSchedule(node, id)
                updateNextStatus(node, true)
            }

            if (Array.isArray(msg?.payload?.ids)) {
                msg.payload.ids.forEach(id => handleTask(id, msg.payload.enabled))
            } else if (msg?.payload?.id) {
                handleTask(msg.payload.id, msg.payload.enabled)
            }
            sendTopicMsg(node, new Date())
            requestSerialisation()
        }

        /**
             * Handles a request to update the status of a schedule based on a message payload.
             *
             * @param {Object} msg - The message object containing the payload.
             * @param {Object} msg.payload - The payload of the message.
             * @param {string} msg.payload.id - The ID of the schedule to update.
             *
             * Logs a warning if the schedule ID is not provided or if the schedule is not found.
             * Updates the schedule status if a valid schedule is retrieved.
             */
        function requestScheduleStatus (msg) {
            if (!msg?.payload?.id) {
                console.warn('No schedule ID provided for status request.')
                return
            }

            const schedule = getSchedule(node, msg.payload.id)
            if (schedule) {
                updateSchedule(node, updateScheduleNextStatus(node, schedule))
                updateNextStatus(node, true)
            } else {
                console.warn(`Schedule not found for ID: ${msg.payload.id}`)
            }
        }

        function exportUISchedule (msg) {
            if (!msg?.payload?.id) {
                console.warn('No schedule ID provided for status request.')
                return
            }

            const schedule = getSchedule(node, msg.payload.id)
            if (schedule) {
                const exportedSchedule = exportSchedule(schedule)
                if (exportedSchedule) {
                    // Remove the id properties from the exported schedule
                    const modifiedSchedule = { ...exportedSchedule }
                    delete modifiedSchedule.id
                    delete modifiedSchedule.primaryTaskId
                    delete modifiedSchedule.endTaskId
                    if (modifiedSchedule.payloadType === 'custom') {
                        modifiedSchedule.payloadValue = getCustomPayload(node, modifiedSchedule.payloadValue)
                        if (modifiedSchedule.endPayloadValue) {
                            modifiedSchedule.endPayloadValue = getCustomPayload(node, modifiedSchedule.endPayloadValue)
                        }
                    }

                    const m = { payload: { exportResult: modifiedSchedule }, event: 'export-schedule' }
                    base.emit(`msg-input:${node.id}`, m, node)
                }
            } else {
                console.warn(`Schedule not found for ID: ${msg.payload.id}`)
            }
        }
        /**
             * Describes a cron expression from the message payload.
             *
             * @param {Object} msg - The message object containing the payload with the cron expression.
             * @returns {void} Emits a message with the detailed description of the cron expression.
             *
             * The function checks for the presence of a cron expression in the message payload.
             * It applies default options, retrieves a detailed description of the cron expression,
             * and formats the next execution dates. The day names in the description are replaced
             * with localized versions. The results are emitted back with the original expression included.
             * Logs a warning if no cron expression is found and handles any errors during processing.
             */
        function describeExpression (msg) {
            if (!msg?.payload?.cronExpression) {
                console.warn('No cronExpression found in the payload.')
                return
            }

            try {
                const cmd = {
                    expression: msg.payload.cronExpression,
                    expressionType: 'cron'
                }

                // Apply defaults to the options
                applyOptionDefaults(node, cmd)

                // Get the detailed cron expression description
                const cronExpression = _describeExpression(
                    cmd.expression,
                    cmd.expressionType,
                    cmd.timeZone || node.timeZone,
                    cmd.offset,
                    cmd.solarType,
                    cmd.solarEvents,
                    null,
                    cmd,
                    node.use24HourFormat, node.locale
                )

                // Replace day names with localized versions if a description exists
                if (cronExpression.description) {
                    cronExpression.description = abbreviateDays(cronExpression.description)
                }

                // Include the original expression in the response
                cronExpression.expression = msg.payload.cronExpression

                // Format next execution dates
                if (Array.isArray(cronExpression.nextDates) && cronExpression.nextDates.length > 0) {
                    cronExpression.nextDates = cronExpression.nextDates.map(dateString => {
                        const date = new Date(dateString)
                        return formatShortDateTimeWithTZ(date, node.timeZone, node.use24HourFormat, node.locale)
                    })
                }

                // Emit the results back
                const message = { payload: { cronExpression }, event: 'describe' }
                base.emit(`msg-input:${node.id}`, message, node)
            } catch (error) {
                console.error('Error in describeExpression:', error)
                node.error(error)
            }
        }
        // #endregion UI Actions

        // region D2

        const beforeSend = async function (msg) {
            if (msg.action) {
                if (msg.action === 'submit') {
                    if (!msg?.payload?.schedules) return
                    submitSchedule(msg.payload?.schedules)
                } else if (msg.action === 'remove') {
                    removeSchedule(msg)
                } else if (msg.action === 'setEnabled') {
                    setScheduleEnabled(msg)
                } else if (msg.action === 'requestStatus') {
                    requestScheduleStatus(msg)
                } else if (msg.action === 'describe') {
                    describeExpression(msg)
                } else if (msg.action === 'checkUpdate') {
                    checkForUpdate(version, packageName, (result) => {
                        if (result) {
                            node.updateAvailable = config.updateAvailable = result.updateAvailable
                            node.currentVersion = config.currentVersion = result.currentVersion
                            node.latestVersion = config.latestVersion = result.latestVersion

                            const m = { payload: { updateResult: { ...result } }, event: 'updateCheck' }
                            if (msg.silent) {
                                m.silent = true
                            }
                            base.emit('msg-input:' + node.id, m, node)
                        } else {
                            console.log('Failed to check for updates.')
                        }
                    })
                } else if (msg.action === 'exportSchedule') {
                    exportUISchedule(msg)
                } else { console.log('Unknown action', msg.action) }

                if (msg.ui_update) {
                    const update = msg.ui_update
                    if (typeof update.label !== 'undefined') {
                        // dynamically set "label" property
                        base.stores.state.set(base, node, msg, 'label', update.label)
                    }
                    if (typeof update.schedules !== 'undefined') {
                        // dynamically set "schedules" property
                        base.stores.state.set(base, node, msg, 'schedules', update.schedules)
                    }
                }
            }
            return msg
        }

        const evts = {
            onAction: true,
            beforeSend,
            onInput: async function (msg) {
                msg = await beforeSend(msg)
                const handledMsg = await handleInput(msg)
                if (handledMsg && Array.isArray(handledMsg)) {
                    node.send(handledMsg)
                }
            }
        }

        if (group) {
            group.register(node, config, evts)
        } else {
            node.error('No group configured')
        }
    }

    // #endregion D2
    // #endregion Node-RED

    function getPayloadAndType (schedule, valueKey, defaultValue) {
        if (schedule?.payloadType === 'custom') {
            return {
                payload: schedule[valueKey] ?? defaultValue,
                payloadType: 'custom'
            }
        } else if (['bool', 'true_false', 'true', 'false', true, false].includes(schedule?.payloadType)) {
            return {
                payload: schedule[valueKey] ?? defaultValue,
                payloadType: 'bool'
            }
        } else {
            return {
                payload: schedule[valueKey] ?? defaultValue,
                payloadType: schedule?.payloadType
            }
        }
    }

    /**
 * Parses a custom payload from the node's custom payloads.
 *
 * If a custom payload with the specified payload ID exists, returns the payload;
 * otherwise, attempts to find a custom payload ID matching the payload value.
 * Returns the matched custom payload ID if found, or null.
 *
 * @param {Object} node - The node to check for a custom payload.
 * @param {*} payload - The payload identifier or value.
 * @returns {*} The original payload or the custom payload ID if found, otherwise null.
 */
    const parseCustomPayload = (node, payload) =>
        customPayloadExists(node, payload)
            ? payload
            : getCustomPayloadId(node, payload) || null

    /**
   * Retrieves the value of a custom payload from the node's custom payloads by its ID.
   *
   * @param {Object} node - The node object containing custom payloads.
   * @param {string} payloadId - The ID of the payload to retrieve.
   * @returns {*} The value of the custom payload if found, otherwise null.
   */
    const getCustomPayload = (node, payloadId) => {
        if (!Array.isArray(node.customPayloads)) return null
        const found = node.customPayloads.find(({ id }) => id === payloadId)
        return found ? found.value : null
    }

    /**
   * Retrieves the ID of a custom payload from the node's custom payloads based on a given payload value.
   *
   * @param {Object} node - The node object containing custom payloads.
   * @param {*} payloadValue - The value of the payload to search for.
   * @returns {string|null} The ID of the matching payload if found, otherwise null.
   */
    const getCustomPayloadId = (node, payloadValue) => {
        if (!Array.isArray(node.customPayloads)) return null
        const found = node.customPayloads.find(({ value }) => value === payloadValue)
        return found ? found.id : null
    }

    /**
   * Checks if a custom payload with the specified ID exists within the node's custom payloads.
   *
   * @param {Object} node - The node object containing custom payloads.
   * @param {string} payloadId - The ID of the payload to search for.
   * @returns {boolean} True if the payload exists, otherwise false.
   */
    const customPayloadExists = (node, payloadId) =>
        Array.isArray(node.customPayloads) && node.customPayloads.some(({ id }) => id === payloadId)

    function evaluateNodeProperty (value, type, node, msg) {
        return new Promise(function (resolve, reject) {
            RED.util.evaluateNodeProperty(value, type, node, msg, function (e, r) {
                if (e) {
                    reject(e)
                } else {
                    resolve(r)
                }
            })
        })
    }

    function contextGet (context, contextKey, storeName) {
        return new Promise(function (resolve, reject) {
            context.get(contextKey, storeName, function (e, r) {
                if (e) {
                    reject(e)
                } else {
                    resolve(r)
                }
            })
        })
    }

    function contextSet (context, contextKey, value, storeName) {
        return new Promise(function (resolve, reject) {
            context.set(contextKey, value, storeName, function (e, r) {
                if (e) {
                    reject(e)
                } else {
                    resolve()
                }
            })
        })
    }

    function getStoreNames () {
        const stores = ['NONE', 'local_file_system']
        if (!RED.settings.contextStorage) {
            return stores
        }
        if (typeof RED.settings.contextStorage !== 'object') {
            return stores
        }
        return [...stores, ...Object.keys(RED.settings.contextStorage)]
    }

    RED.httpAdmin.post('/ui-schedulerinject/:id', RED.auth.needsPermission('ui-scheduler.write'), function (req, res) {
        const node = RED.nodes.getNode(req.params.id)
        if (node != null) {
            try {
                node.receive()
                res.sendStatus(200)
            } catch (err) {
                res.sendStatus(500)
                node.error(RED._('inject.failed', { error: err.toString() }))
            }
        } else {
            res.sendStatus(404)
        }
    })

    RED.httpAdmin.post('/ui-scheduler/:id/:operation', RED.auth.needsPermission('ui-scheduler.read'), async function (req, res) {
        try {
            const operation = req.params.operation
            const node = RED.nodes.getNode(req.params.id)
            if (operation === 'expressionTip') {
                const timeZone = req.body.timeZone ? req.body.timeZone : undefined
                const expressionType = req.body.expressionType ? req.body.expressionType : undefined
                const opts = { expression: req.body.expression }
                if (timeZone) opts.timezone = timeZone
                if (expressionType) {
                    opts.expressionType = expressionType
                    if (opts.expressionType === 'solar') {
                        opts.solarType = req.body.solarType || ''
                        opts.solarEvents = req.body.solarEvents || ''
                        let pos = ''
                        const fakeNode = () => {
                            const n = {
                                id: req.body.nodeId,
                                _flow: {} // something - get the flow object based on req.body.flowId fc65972c8d3b1d68
                            }
                            return n
                        }

                        if (req.body.defaultLocationType === 'env') {
                            if (req.body.env) {
                                for (let index = 0; index < req.body.env.length; index++) {
                                    const envVar = req.body.env[index]
                                    if (envVar.name === req.body.defaultLocation) {
                                        pos = await evaluateNodeProperty(envVar.value, envVar.type, fakeNode())
                                        break
                                    }
                                }
                            }
                            if (!pos && node) {
                                pos = await evaluateNodeProperty(node.defaultLocation, node.defaultLocationType, node)
                            }
                        } else if (req.body.defaultLocationType === 'fixed') {
                            if (node) {
                                pos = await evaluateNodeProperty(req.body.defaultLocation, req.body.defaultLocationType, node)
                            } else {
                                pos = await evaluateNodeProperty(req.body.defaultLocation, req.body.defaultLocationType, fakeNode())
                            }
                        } else { // per schedule
                            let loc = (req.body.location + '').trim()
                            let locType = 'str'
                            if (/\$\{(.+)\}/.test(loc)) {
                                locType = 'env'
                                loc = /\$\{(.+)\}/.exec(loc)[1]
                            }
                            if (locType === 'env') {
                                for (let index = 0; index < req.body.env.length; index++) {
                                    const envVar = req.body.env[index]
                                    if (envVar.name === loc) {
                                        pos = await evaluateNodeProperty(envVar.value, envVar.type, node || fakeNode())
                                        break
                                    }
                                }
                            } else {
                                pos = await evaluateNodeProperty(loc, 'str', node || fakeNode())
                            }
                        }
                        opts.location = pos || ''
                        opts.offset = req.body.offset || 0
                    }
                }
                const exp = (opts.expressionType === 'solar') ? opts.location : opts.expression
                const h = _describeExpression(exp, opts.expressionType, opts.timezone, opts.offset, opts.solarType, opts.solarEvents, null, { locationType: opts.locationType || opts.defaultLocationType, defaultLocationType: opts.defaultLocationType, defaultLocation: opts.defaultLocation })
                let r = null
                if (opts.expressionType === 'solar') {
                    const times = h.eventTimes && h.eventTimes.slice(1)
                    r = {
                        ...opts,
                        // description: desc,
                        description: h.description,
                        // next: next,
                        next: h.nextEventTimeOffset,
                        // nextEventDesc: nextEventDesc,
                        nextEventDesc: h.nextEvent,
                        // prettyNext: prettyNext,
                        prettyNext: h.prettyNext,
                        // nextDates: nextDates
                        nextDates: times
                    }
                } else {
                    const times = h.nextDates && h.nextDates.slice(1)
                    r = {
                        ...opts,
                        description: h.description,
                        // next: next,
                        next: h.nextDate,
                        // nextEventDesc: nextEventDesc,
                        nextEventDesc: h.nextDescription,
                        // prettyNext: prettyNext,
                        prettyNext: h.prettyNext,
                        // nextDates: nextDates
                        nextDates: times
                    }
                }

                res.json(r)
            } else if (operation === 'getDynamic') {
                if (!node) {
                    res.json([])
                    return
                }
                const dynSchedules = node.schedules.filter(schedule => schedule && schedule.isStatic !== true)
                const exp = (schedule) => {
                    return {
                        config: exportSchedule(schedule),
                        status: getScheduleStatus(node, schedule, true)
                    }
                }
                const dynSchedulesExp = dynSchedules.map(exp)

                res.json(dynSchedulesExp)
            } else if (operation === 'tz') {
                res.json(timeZones)
            }
        } catch (err) {
            res.sendStatus(500)
            console.debug(err)
        }
    })

    RED.nodes.registerType('ui-scheduler', SchedulerNode)
}

/**
             * Array of timezones
             */
const timeZones = [
    { code: 'CI', latLon: '+0519-00402', tz: 'Africa/Abidjan', UTCOffset: '+00:00', UTCDSTOffset: '+00:00' },
    { code: 'GH', latLon: '+0533-00013', tz: 'Africa/Accra', UTCOffset: '+00:00', UTCDSTOffset: '+00:00' },
    { code: 'DZ', latLon: '3950', tz: 'Africa/Algiers', UTCOffset: '+01:00', UTCDSTOffset: '+01:00' },
    { code: 'GW', latLon: '+1151-01535', tz: 'Africa/Bissau', UTCOffset: '+00:00', UTCDSTOffset: '+00:00' },
    { code: 'EG', latLon: '6118', tz: 'Africa/Cairo', UTCOffset: '+02:00', UTCDSTOffset: '+02:00' },
    { code: 'MA', latLon: '+3339-00735', tz: 'Africa/Casablanca', UTCOffset: '+01:00', UTCDSTOffset: '+01:00' },
    { code: 'ES', latLon: '+3553-00519', tz: 'Africa/Ceuta', UTCOffset: '+01:00', UTCDSTOffset: '+02:00' },
    { code: 'EH', latLon: '+2709-01312', tz: 'Africa/El_Aaiun', UTCOffset: '+00:00', UTCDSTOffset: '+01:00' },
    { code: 'ZA', latLon: '-2615+02800', tz: 'Africa/Johannesburg', UTCOffset: '+02:00', UTCDSTOffset: '+02:00' },
    { code: 'SS', latLon: '3587', tz: 'Africa/Juba', UTCOffset: '+03:00', UTCDSTOffset: '+03:00' },
    { code: 'SD', latLon: '4768', tz: 'Africa/Khartoum', UTCOffset: '+02:00', UTCDSTOffset: '+02:00' },
    { code: 'NG', latLon: '951', tz: 'Africa/Lagos', UTCOffset: '+01:00', UTCDSTOffset: '+01:00' },
    { code: 'MZ', latLon: '-2558+03235', tz: 'Africa/Maputo', UTCOffset: '+02:00', UTCDSTOffset: '+02:00' },
    { code: 'LR', latLon: '+0618-01047', tz: 'Africa/Monrovia', UTCOffset: '+00:00', UTCDSTOffset: '+00:00' },
    { code: 'KE', latLon: '-0117+03649', tz: 'Africa/Nairobi', UTCOffset: '+03:00', UTCDSTOffset: '+03:00' },
    { code: 'TD', latLon: '2710', tz: 'Africa/Ndjamena', UTCOffset: '+01:00', UTCDSTOffset: '+01:00' },
    { code: 'LY', latLon: '4565', tz: 'Africa/Tripoli', UTCOffset: '+02:00', UTCDSTOffset: '+02:00' },
    { code: 'TN', latLon: '4659', tz: 'Africa/Tunis', UTCOffset: '+01:00', UTCDSTOffset: '+01:00' },
    { code: 'NA', latLon: '-2234+01706', tz: 'Africa/Windhoek', UTCOffset: '+02:00', UTCDSTOffset: '+02:00' },
    { code: 'US', latLon: '+515248-1763929', tz: 'America/Adak', UTCOffset: '-10:00', UTCDSTOffset: '-09:00' },
    { code: 'US', latLon: '+611305-1495401', tz: 'America/Anchorage', UTCOffset: '-09:00', UTCDSTOffset: '-08:00' },
    { code: 'BR', latLon: '-0712-04812', tz: 'America/Araguaina', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'AR', latLon: '-3436-05827', tz: 'America/Argentina/Buenos_Aires', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'AR', latLon: '-2828-06547', tz: 'America/Argentina/Catamarca', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'AR', latLon: '-3124-06411', tz: 'America/Argentina/Cordoba', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'AR', latLon: '-2411-06518', tz: 'America/Argentina/Jujuy', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'AR', latLon: '-2926-06651', tz: 'America/Argentina/La_Rioja', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'AR', latLon: '-3253-06849', tz: 'America/Argentina/Mendoza', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'AR', latLon: '-5138-06913', tz: 'America/Argentina/Rio_Gallegos', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'AR', latLon: '-2447-06525', tz: 'America/Argentina/Salta', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'AR', latLon: '-3132-06831', tz: 'America/Argentina/San_Juan', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'AR', latLon: '-3319-06621', tz: 'America/Argentina/San_Luis', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'AR', latLon: '-2649-06513', tz: 'America/Argentina/Tucuman', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'AR', latLon: '-5448-06818', tz: 'America/Argentina/Ushuaia', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'PY', latLon: '-2516-05740', tz: 'America/Asuncion', UTCOffset: '-04:00', UTCDSTOffset: '-03:00' },
    { code: 'CA', latLon: '+484531-0913718', tz: 'America/Atikokan', UTCOffset: '-05:00', UTCDSTOffset: '-05:00' },
    { code: 'BR', latLon: '-1259-03831', tz: 'America/Bahia', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'MX', latLon: '+2048-10515', tz: 'America/Bahia_Banderas', UTCOffset: '-06:00', UTCDSTOffset: '-05:00' },
    { code: 'BB', latLon: '+1306-05937', tz: 'America/Barbados', UTCOffset: '-04:00', UTCDSTOffset: '-04:00' },
    { code: 'BR', latLon: '-0127-04829', tz: 'America/Belem', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'BZ', latLon: '+1730-08812', tz: 'America/Belize', UTCOffset: '-06:00', UTCDSTOffset: '-06:00' },
    { code: 'CA', latLon: '+5125-05707', tz: 'America/Blanc-Sablon', UTCOffset: '-04:00', UTCDSTOffset: '-04:00' },
    { code: 'BR', latLon: '+0249-06040', tz: 'America/Boa_Vista', UTCOffset: '-04:00', UTCDSTOffset: '-04:00' },
    { code: 'CO', latLon: '+0436-07405', tz: 'America/Bogota', UTCOffset: '-05:00', UTCDSTOffset: '-05:00' },
    { code: 'US', latLon: '+433649-1161209', tz: 'America/Boise', UTCOffset: '-07:00', UTCDSTOffset: '-06:00' },
    { code: 'CA', latLon: '+690650-1050310', tz: 'America/Cambridge_Bay', UTCOffset: '-07:00', UTCDSTOffset: '-06:00' },
    { code: 'BR', latLon: '-2027-05437', tz: 'America/Campo_Grande', UTCOffset: '-04:00', UTCDSTOffset: '-04:00' },
    { code: 'MX', latLon: '+2105-08646', tz: 'America/Cancun', UTCOffset: '-05:00', UTCDSTOffset: '-05:00' },
    { code: 'VE', latLon: '+1030-06656', tz: 'America/Caracas', UTCOffset: '-04:00', UTCDSTOffset: '-04:00' },
    { code: 'GF', latLon: '+0456-05220', tz: 'America/Cayenne', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'US', latLon: '+4151-08739', tz: 'America/Chicago', UTCOffset: '-06:00', UTCDSTOffset: '-05:00' },
    { code: 'MX', latLon: '+2838-10605', tz: 'America/Chihuahua', UTCOffset: '-07:00', UTCDSTOffset: '-06:00' },
    { code: 'CR', latLon: '+0956-08405', tz: 'America/Costa_Rica', UTCOffset: '-06:00', UTCDSTOffset: '-06:00' },
    { code: 'CA', latLon: '+4906-11631', tz: 'America/Creston', UTCOffset: '-07:00', UTCDSTOffset: '-07:00' },
    { code: 'BR', latLon: '-1535-05605', tz: 'America/Cuiaba', UTCOffset: '-04:00', UTCDSTOffset: '-04:00' },
    { code: 'CW', latLon: '+1211-06900', tz: 'America/Curacao', UTCOffset: '-04:00', UTCDSTOffset: '-04:00' },
    { code: 'GL', latLon: '+7646-01840', tz: 'America/Danmarkshavn', UTCOffset: '+00:00', UTCDSTOffset: '+00:00' },
    { code: 'CA', latLon: '+6404-13925', tz: 'America/Dawson', UTCOffset: '-08:00', UTCDSTOffset: '-07:00' },
    { code: 'CA', latLon: '+5946-12014', tz: 'America/Dawson_Creek', UTCOffset: '-07:00', UTCDSTOffset: '-07:00' },
    { code: 'US', latLon: '+394421-1045903', tz: 'America/Denver', UTCOffset: '-07:00', UTCDSTOffset: '-06:00' },
    { code: 'US', latLon: '+421953-0830245', tz: 'America/Detroit', UTCOffset: '-05:00', UTCDSTOffset: '-04:00' },
    { code: 'CA', latLon: '+5333-11328', tz: 'America/Edmonton', UTCOffset: '-07:00', UTCDSTOffset: '-06:00' },
    { code: 'BR', latLon: '-0640-06952', tz: 'America/Eirunepe', UTCOffset: '-05:00', UTCDSTOffset: '-05:00' },
    { code: 'SV', latLon: '+1342-08912', tz: 'America/El_Salvador', UTCOffset: '-06:00', UTCDSTOffset: '-06:00' },
    { code: 'CA', latLon: '+5848-12242', tz: 'America/Fort_Nelson', UTCOffset: '-07:00', UTCDSTOffset: '-07:00' },
    { code: 'BR', latLon: '-0343-03830', tz: 'America/Fortaleza', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'CA', latLon: '+4612-05957', tz: 'America/Glace_Bay', UTCOffset: '-04:00', UTCDSTOffset: '-03:00' },
    { code: 'GL', latLon: '+6411-05144', tz: 'America/Godthab', UTCOffset: '-03:00', UTCDSTOffset: '-02:00' },
    { code: 'CA', latLon: '+5320-06025', tz: 'America/Goose_Bay', UTCOffset: '-04:00', UTCDSTOffset: '-03:00' },
    { code: 'TC', latLon: '+2128-07108', tz: 'America/Grand_Turk', UTCOffset: '-05:00', UTCDSTOffset: '-04:00' },
    { code: 'GT', latLon: '+1438-09031', tz: 'America/Guatemala', UTCOffset: '-06:00', UTCDSTOffset: '-06:00' },
    { code: 'EC', latLon: '-0210-07950', tz: 'America/Guayaquil', UTCOffset: '-05:00', UTCDSTOffset: '-05:00' },
    { code: 'GY', latLon: '+0648-05810', tz: 'America/Guyana', UTCOffset: '-04:00', UTCDSTOffset: '-04:00' },
    { code: 'CA', latLon: '+4439-06336', tz: 'America/Halifax', UTCOffset: '-04:00', UTCDSTOffset: '-03:00' },
    { code: 'CU', latLon: '+2308-08222', tz: 'America/Havana', UTCOffset: '-05:00', UTCDSTOffset: '-04:00' },
    { code: 'MX', latLon: '+2904-11058', tz: 'America/Hermosillo', UTCOffset: '-07:00', UTCDSTOffset: '-07:00' },
    { code: 'US', latLon: '+394606-0860929', tz: 'America/Indiana/Indianapolis', UTCOffset: '-05:00', UTCDSTOffset: '-04:00' },
    { code: 'US', latLon: '+411745-0863730', tz: 'America/Indiana/Knox', UTCOffset: '-06:00', UTCDSTOffset: '-05:00' },
    { code: 'US', latLon: '+382232-0862041', tz: 'America/Indiana/Marengo', UTCOffset: '-05:00', UTCDSTOffset: '-04:00' },
    { code: 'US', latLon: '+382931-0871643', tz: 'America/Indiana/Petersburg', UTCOffset: '-05:00', UTCDSTOffset: '-04:00' },
    { code: 'US', latLon: '+375711-0864541', tz: 'America/Indiana/Tell_City', UTCOffset: '-06:00', UTCDSTOffset: '-05:00' },
    { code: 'US', latLon: '+384452-0850402', tz: 'America/Indiana/Vevay', UTCOffset: '-05:00', UTCDSTOffset: '-04:00' },
    { code: 'US', latLon: '+384038-0873143', tz: 'America/Indiana/Vincennes', UTCOffset: '-05:00', UTCDSTOffset: '-04:00' },
    { code: 'US', latLon: '+410305-0863611', tz: 'America/Indiana/Winamac', UTCOffset: '-05:00', UTCDSTOffset: '-04:00' },
    { code: 'CA', latLon: '+682059-13343', tz: 'America/Inuvik', UTCOffset: '-07:00', UTCDSTOffset: '-06:00' },
    { code: 'CA', latLon: '+6344-06828', tz: 'America/Iqaluit', UTCOffset: '-05:00', UTCDSTOffset: '-04:00' },
    { code: 'JM', latLon: '+175805-0764736', tz: 'America/Jamaica', UTCOffset: '-05:00', UTCDSTOffset: '-05:00' },
    { code: 'US', latLon: '+581807-1342511', tz: 'America/Juneau', UTCOffset: '-09:00', UTCDSTOffset: '-08:00' },
    { code: 'US', latLon: '+381515-0854534', tz: 'America/Kentucky/Louisville', UTCOffset: '-05:00', UTCDSTOffset: '-04:00' },
    { code: 'US', latLon: '+364947-0845057', tz: 'America/Kentucky/Monticello', UTCOffset: '-05:00', UTCDSTOffset: '-04:00' },
    { code: 'BO', latLon: '-1630-06809', tz: 'America/La_Paz', UTCOffset: '-04:00', UTCDSTOffset: '-04:00' },
    { code: 'PE', latLon: '-1203-07703', tz: 'America/Lima', UTCOffset: '-05:00', UTCDSTOffset: '-05:00' },
    { code: 'US', latLon: '+340308-1181434', tz: 'America/Los_Angeles', UTCOffset: '-08:00', UTCDSTOffset: '-07:00' },
    { code: 'BR', latLon: '-0940-03543', tz: 'America/Maceio', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'NI', latLon: '+1209-08617', tz: 'America/Managua', UTCOffset: '-06:00', UTCDSTOffset: '-06:00' },
    { code: 'BR', latLon: '-0308-06001', tz: 'America/Manaus', UTCOffset: '-04:00', UTCDSTOffset: '-04:00' },
    { code: 'MQ', latLon: '+1436-06105', tz: 'America/Martinique', UTCOffset: '-04:00', UTCDSTOffset: '-04:00' },
    { code: 'MX', latLon: '+2550-09730', tz: 'America/Matamoros', UTCOffset: '-06:00', UTCDSTOffset: '-05:00' },
    { code: 'MX', latLon: '+2313-10625', tz: 'America/Mazatlan', UTCOffset: '-07:00', UTCDSTOffset: '-06:00' },
    { code: 'US', latLon: '+450628-0873651', tz: 'America/Menominee', UTCOffset: '-06:00', UTCDSTOffset: '-05:00' },
    { code: 'MX', latLon: '+2058-08937', tz: 'America/Merida', UTCOffset: '-06:00', UTCDSTOffset: '-05:00' },
    { code: 'US', latLon: '+550737-1313435', tz: 'America/Metlakatla', UTCOffset: '-09:00', UTCDSTOffset: '-08:00' },
    { code: 'MX', latLon: '+1924-09909', tz: 'America/Mexico_City', UTCOffset: '-06:00', UTCDSTOffset: '-05:00' },
    { code: 'PM', latLon: '+4703-05620', tz: 'America/Miquelon', UTCOffset: '-03:00', UTCDSTOffset: '-02:00' },
    { code: 'CA', latLon: '+4606-06447', tz: 'America/Moncton', UTCOffset: '-04:00', UTCDSTOffset: '-03:00' },
    { code: 'MX', latLon: '+2540-10019', tz: 'America/Monterrey', UTCOffset: '-06:00', UTCDSTOffset: '-05:00' },
    { code: 'UY', latLon: '-3453-05611', tz: 'America/Montevideo', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'BS', latLon: '+2505-07721', tz: 'America/Nassau', UTCOffset: '-05:00', UTCDSTOffset: '-04:00' },
    { code: 'US', latLon: '+404251-0740023', tz: 'America/New_York', UTCOffset: '-05:00', UTCDSTOffset: '-04:00' },
    { code: 'CA', latLon: '+4901-08816', tz: 'America/Nipigon', UTCOffset: '-05:00', UTCDSTOffset: '-04:00' },
    { code: 'US', latLon: '+643004-1652423', tz: 'America/Nome', UTCOffset: '-09:00', UTCDSTOffset: '-08:00' },
    { code: 'BR', latLon: '-0351-03225', tz: 'America/Noronha', UTCOffset: '-02:00', UTCDSTOffset: '-02:00' },
    { code: 'US', latLon: '+471551-1014640', tz: 'America/North_Dakota/Beulah', UTCOffset: '-06:00', UTCDSTOffset: '-05:00' },
    { code: 'US', latLon: '+470659-1011757', tz: 'America/North_Dakota/Center', UTCOffset: '-06:00', UTCDSTOffset: '-05:00' },
    { code: 'US', latLon: '+465042-1012439', tz: 'America/North_Dakota/New_Salem', UTCOffset: '-06:00', UTCDSTOffset: '-05:00' },
    { code: 'MX', latLon: '+2934-10425', tz: 'America/Ojinaga', UTCOffset: '-07:00', UTCDSTOffset: '-06:00' },
    { code: 'PA', latLon: '+0858-07932', tz: 'America/Panama', UTCOffset: '-05:00', UTCDSTOffset: '-05:00' },
    { code: 'CA', latLon: '+6608-06544', tz: 'America/Pangnirtung', UTCOffset: '-05:00', UTCDSTOffset: '-04:00' },
    { code: 'SR', latLon: '+0550-05510', tz: 'America/Paramaribo', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'US', latLon: '+332654-1120424', tz: 'America/Phoenix', UTCOffset: '-07:00', UTCDSTOffset: '-07:00' },
    { code: 'TT', latLon: '+1039-06131', tz: 'America/Port_of_Spain', UTCOffset: '-04:00', UTCDSTOffset: '-04:00' },
    { code: 'HT', latLon: '+1832-07220', tz: 'America/Port-au-Prince', UTCOffset: '-05:00', UTCDSTOffset: '-04:00' },
    { code: 'BR', latLon: '-0846-06354', tz: 'America/Porto_Velho', UTCOffset: '-04:00', UTCDSTOffset: '-04:00' },
    { code: 'PR', latLon: '+182806-0660622', tz: 'America/Puerto_Rico', UTCOffset: '-04:00', UTCDSTOffset: '-04:00' },
    { code: 'CL', latLon: '-5309-07055', tz: 'America/Punta_Arenas', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'CA', latLon: '+4843-09434', tz: 'America/Rainy_River', UTCOffset: '-06:00', UTCDSTOffset: '-05:00' },
    { code: 'CA', latLon: '+6249-0920459', tz: 'America/Rankin_Inlet', UTCOffset: '-06:00', UTCDSTOffset: '-05:00' },
    { code: 'BR', latLon: '-0803-03454', tz: 'America/Recife', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'CA', latLon: '+5024-10439', tz: 'America/Regina', UTCOffset: '-06:00', UTCDSTOffset: '-06:00' },
    { code: 'CA', latLon: '+744144-0944945', tz: 'America/Resolute', UTCOffset: '-06:00', UTCDSTOffset: '-05:00' },
    { code: 'BR', latLon: '-0958-06748', tz: 'America/Rio_Branco', UTCOffset: '-05:00', UTCDSTOffset: '-05:00' },
    { code: 'BR', latLon: '-0226-05452', tz: 'America/Santarem', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'CL', latLon: '-3327-07040', tz: 'America/Santiago', UTCOffset: '-04:00', UTCDSTOffset: '-03:00' },
    { code: 'DO', latLon: '+1828-06954', tz: 'America/Santo_Domingo', UTCOffset: '-04:00', UTCDSTOffset: '-04:00' },
    { code: 'BR', latLon: '-2332-04637', tz: 'America/Sao_Paulo', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'GL', latLon: '+7029-02158', tz: 'America/Scoresbysund', UTCOffset: '-01:00', UTCDSTOffset: '+00:00' },
    { code: 'US', latLon: '+571035-1351807', tz: 'America/Sitka', UTCOffset: '-09:00', UTCDSTOffset: '-08:00' },
    { code: 'CA', latLon: '+4734-05243', tz: 'America/St_Johns', UTCOffset: '-03:30', UTCDSTOffset: '-02:30' },
    { code: 'CA', latLon: '+5017-10750', tz: 'America/Swift_Current', UTCOffset: '-06:00', UTCDSTOffset: '-06:00' },
    { code: 'HN', latLon: '+1406-08713', tz: 'America/Tegucigalpa', UTCOffset: '-06:00', UTCDSTOffset: '-06:00' },
    { code: 'GL', latLon: '+7634-06847', tz: 'America/Thule', UTCOffset: '-04:00', UTCDSTOffset: '-03:00' },
    { code: 'CA', latLon: '+4823-08915', tz: 'America/Thunder_Bay', UTCOffset: '-05:00', UTCDSTOffset: '-04:00' },
    { code: 'MX', latLon: '+3232-11701', tz: 'America/Tijuana', UTCOffset: '-08:00', UTCDSTOffset: '-07:00' },
    { code: 'CA', latLon: '+4339-07923', tz: 'America/Toronto', UTCOffset: '-05:00', UTCDSTOffset: '-04:00' },
    { code: 'CA', latLon: '+4916-12307', tz: 'America/Vancouver', UTCOffset: '-08:00', UTCDSTOffset: '-07:00' },
    { code: 'CA', latLon: '+6043-13503', tz: 'America/Whitehorse', UTCOffset: '-08:00', UTCDSTOffset: '-07:00' },
    { code: 'CA', latLon: '+4953-09709', tz: 'America/Winnipeg', UTCOffset: '-06:00', UTCDSTOffset: '-05:00' },
    { code: 'US', latLon: '+593249-1394338', tz: 'America/Yakutat', UTCOffset: '-09:00', UTCDSTOffset: '-08:00' },
    { code: 'CA', latLon: '+6227-11421', tz: 'America/Yellowknife', UTCOffset: '-07:00', UTCDSTOffset: '-06:00' },
    { code: 'AQ', latLon: '-6617+11031', tz: 'Antarctica/Casey', UTCOffset: '+11:00', UTCDSTOffset: '+11:00' },
    { code: 'AQ', latLon: '-6835+07758', tz: 'Antarctica/Davis', UTCOffset: '+07:00', UTCDSTOffset: '+07:00' },
    { code: 'AQ', latLon: '-6640+14001', tz: 'Antarctica/DumontDUrville', UTCOffset: '+10:00', UTCDSTOffset: '+10:00' },
    { code: 'AU', latLon: '-5430+15857', tz: 'Antarctica/Macquarie', UTCOffset: '+11:00', UTCDSTOffset: '+11:00' },
    { code: 'AQ', latLon: '-6736+06253', tz: 'Antarctica/Mawson', UTCOffset: '+05:00', UTCDSTOffset: '+05:00' },
    { code: 'AQ', latLon: '-6448-06406', tz: 'Antarctica/Palmer', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'AQ', latLon: '-6734-06808', tz: 'Antarctica/Rothera', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'AQ', latLon: '-690022+0393524', tz: 'Antarctica/Syowa', UTCOffset: '+03:00', UTCDSTOffset: '+03:00' },
    { code: 'AQ', latLon: '-720041+0023206', tz: 'Antarctica/Troll', UTCOffset: '+00:00', UTCDSTOffset: '+02:00' },
    { code: 'AQ', latLon: '-7824+10654', tz: 'Antarctica/Vostok', UTCOffset: '+06:00', UTCDSTOffset: '+06:00' },
    { code: 'KZ', latLon: '11972', tz: 'Asia/Almaty', UTCOffset: '+06:00', UTCDSTOffset: '+06:00' },
    { code: 'JO', latLon: '6713', tz: 'Asia/Amman', UTCOffset: '+02:00', UTCDSTOffset: '+03:00' },
    { code: 'RU', latLon: '24174', tz: 'Asia/Anadyr', UTCOffset: '+12:00', UTCDSTOffset: '+12:00' },
    { code: 'KZ', latLon: '9447', tz: 'Asia/Aqtau', UTCOffset: '+05:00', UTCDSTOffset: '+05:00' },
    { code: 'KZ', latLon: '10727', tz: 'Asia/Aqtobe', UTCOffset: '+05:00', UTCDSTOffset: '+05:00' },
    { code: 'TM', latLon: '9580', tz: 'Asia/Ashgabat', UTCOffset: '+05:00', UTCDSTOffset: '+05:00' },
    { code: 'KZ', latLon: '9863', tz: 'Asia/Atyrau', UTCOffset: '+05:00', UTCDSTOffset: '+05:00' },
    { code: 'IQ', latLon: '7746', tz: 'Asia/Baghdad', UTCOffset: '+03:00', UTCDSTOffset: '+03:00' },
    { code: 'AZ', latLon: '8974', tz: 'Asia/Baku', UTCOffset: '+04:00', UTCDSTOffset: '+04:00' },
    { code: 'TH', latLon: '11376', tz: 'Asia/Bangkok', UTCOffset: '+07:00', UTCDSTOffset: '+07:00' },
    { code: 'RU', latLon: '13667', tz: 'Asia/Barnaul', UTCOffset: '+07:00', UTCDSTOffset: '+07:00' },
    { code: 'LB', latLon: '6883', tz: 'Asia/Beirut', UTCOffset: '+02:00', UTCDSTOffset: '+03:00' },
    { code: 'KG', latLon: '11690', tz: 'Asia/Bishkek', UTCOffset: '+06:00', UTCDSTOffset: '+06:00' },
    { code: 'BN', latLon: '11911', tz: 'Asia/Brunei', UTCOffset: '+08:00', UTCDSTOffset: '+08:00' },
    { code: 'RU', latLon: '16531', tz: 'Asia/Chita', UTCOffset: '+09:00', UTCDSTOffset: '+09:00' },
    { code: 'MN', latLon: '16234', tz: 'Asia/Choibalsan', UTCOffset: '+08:00', UTCDSTOffset: '+08:00' },
    { code: 'LK', latLon: '8607', tz: 'Asia/Colombo', UTCOffset: '+05:30', UTCDSTOffset: '+05:30' },
    { code: 'SY', latLon: '6948', tz: 'Asia/Damascus', UTCOffset: '+02:00', UTCDSTOffset: '+03:00' },
    { code: 'BD', latLon: '11368', tz: 'Asia/Dhaka', UTCOffset: '+06:00', UTCDSTOffset: '+06:00' },
    { code: 'TL', latLon: '-0833+12535', tz: 'Asia/Dili', UTCOffset: '+09:00', UTCDSTOffset: '+09:00' },
    { code: 'AE', latLon: '8036', tz: 'Asia/Dubai', UTCOffset: '+04:00', UTCDSTOffset: '+04:00' },
    { code: 'TJ', latLon: '10683', tz: 'Asia/Dushanbe', UTCOffset: '+05:00', UTCDSTOffset: '+05:00' },
    { code: 'CY', latLon: '6864', tz: 'Asia/Famagusta', UTCOffset: '+02:00', UTCDSTOffset: '+02:00' },
    { code: 'PS', latLon: '6558', tz: 'Asia/Gaza', UTCOffset: '+02:00', UTCDSTOffset: '+03:00' },
    { code: 'PS', latLon: '353674', tz: 'Asia/Hebron', UTCOffset: '+02:00', UTCDSTOffset: '+03:00' },
    { code: 'VN', latLon: '11685', tz: 'Asia/Ho_Chi_Minh', UTCOffset: '+07:00', UTCDSTOffset: '+07:00' },
    { code: 'HK', latLon: '13626', tz: 'Asia/Hong_Kong', UTCOffset: '+08:00', UTCDSTOffset: '+08:00' },
    { code: 'MN', latLon: '13940', tz: 'Asia/Hovd', UTCOffset: '+07:00', UTCDSTOffset: '+07:00' },
    { code: 'RU', latLon: '15636', tz: 'Asia/Irkutsk', UTCOffset: '+08:00', UTCDSTOffset: '+08:00' },
    { code: 'ID', latLon: '-0610+10648', tz: 'Asia/Jakarta', UTCOffset: '+07:00', UTCDSTOffset: '+07:00' },
    { code: 'ID', latLon: '-0232+14042', tz: 'Asia/Jayapura', UTCOffset: '+09:00', UTCDSTOffset: '+09:00' },
    { code: 'IL', latLon: '665976', tz: 'Asia/Jerusalem', UTCOffset: '+02:00', UTCDSTOffset: '+03:00' },
    { code: 'AF', latLon: '10343', tz: 'Asia/Kabul', UTCOffset: '+04:30', UTCDSTOffset: '+04:30' },
    { code: 'RU', latLon: '21140', tz: 'Asia/Kamchatka', UTCOffset: '+12:00', UTCDSTOffset: '+12:00' },
    { code: 'PK', latLon: '9155', tz: 'Asia/Karachi', UTCOffset: '+05:00', UTCDSTOffset: '+05:00' },
    { code: 'NP', latLon: '11262', tz: 'Asia/Kathmandu', UTCOffset: '+05:45', UTCDSTOffset: '+05:45' },
    { code: 'RU', latLon: '1977237', tz: 'Asia/Khandyga', UTCOffset: '+09:00', UTCDSTOffset: '+09:00' },
    { code: 'IN', latLon: '11054', tz: 'Asia/Kolkata', UTCOffset: '+05:30', UTCDSTOffset: '+05:30' },
    { code: 'RU', latLon: '14851', tz: 'Asia/Krasnoyarsk', UTCOffset: '+07:00', UTCDSTOffset: '+07:00' },
    { code: 'MY', latLon: '10452', tz: 'Asia/Kuala_Lumpur', UTCOffset: '+08:00', UTCDSTOffset: '+08:00' },
    { code: 'MY', latLon: '11153', tz: 'Asia/Kuching', UTCOffset: '+08:00', UTCDSTOffset: '+08:00' },
    { code: 'MO', latLon: '13549', tz: 'Asia/Macau', UTCOffset: '+08:00', UTCDSTOffset: '+08:00' },
    { code: 'RU', latLon: '20982', tz: 'Asia/Magadan', UTCOffset: '+11:00', UTCDSTOffset: '+11:00' },
    { code: 'ID', latLon: '-0507+11924', tz: 'Asia/Makassar', UTCOffset: '+08:00', UTCDSTOffset: '+08:00' },
    { code: 'PH', latLon: '13535', tz: 'Asia/Manila', UTCOffset: '+08:00', UTCDSTOffset: '+08:00' },
    { code: 'RU', latLon: '14052', tz: 'Asia/Novokuznetsk', UTCOffset: '+07:00', UTCDSTOffset: '+07:00' },
    { code: 'RU', latLon: '13757', tz: 'Asia/Novosibirsk', UTCOffset: '+07:00', UTCDSTOffset: '+07:00' },
    { code: 'RU', latLon: '12824', tz: 'Asia/Omsk', UTCOffset: '+06:00', UTCDSTOffset: '+06:00' },
    { code: 'KZ', latLon: '10234', tz: 'Asia/Oral', UTCOffset: '+05:00', UTCDSTOffset: '+05:00' },
    { code: 'ID', latLon: '-0002+10920', tz: 'Asia/Pontianak', UTCOffset: '+07:00', UTCDSTOffset: '+07:00' },
    { code: 'KP', latLon: '16446', tz: 'Asia/Pyongyang', UTCOffset: '+09:00', UTCDSTOffset: '+09:00' },
    { code: 'QA', latLon: '7649', tz: 'Asia/Qatar', UTCOffset: '+03:00', UTCDSTOffset: '+03:00' },
    { code: 'KZ', latLon: '10976', tz: 'Asia/Qyzylorda', UTCOffset: '+05:00', UTCDSTOffset: '+05:00' },
    { code: 'SA', latLon: '7081', tz: 'Asia/Riyadh', UTCOffset: '+03:00', UTCDSTOffset: '+03:00' },
    { code: 'RU', latLon: '18900', tz: 'Asia/Sakhalin', UTCOffset: '+11:00', UTCDSTOffset: '+11:00' },
    { code: 'UZ', latLon: '10588', tz: 'Asia/Samarkand', UTCOffset: '+05:00', UTCDSTOffset: '+05:00' },
    { code: 'KR', latLon: '16391', tz: 'Asia/Seoul', UTCOffset: '+09:00', UTCDSTOffset: '+09:00' },
    { code: 'CN', latLon: '15242', tz: 'Asia/Shanghai', UTCOffset: '+08:00', UTCDSTOffset: '+08:00' },
    { code: 'SG', latLon: '10468', tz: 'Asia/Singapore', UTCOffset: '+08:00', UTCDSTOffset: '+08:00' },
    { code: 'RU', latLon: '22071', tz: 'Asia/Srednekolymsk', UTCOffset: '+11:00', UTCDSTOffset: '+11:00' },
    { code: 'TW', latLon: '14633', tz: 'Asia/Taipei', UTCOffset: '+08:00', UTCDSTOffset: '+08:00' },
    { code: 'UZ', latLon: '11038', tz: 'Asia/Tashkent', UTCOffset: '+05:00', UTCDSTOffset: '+05:00' },
    { code: 'GE', latLon: '8592', tz: 'Asia/Tbilisi', UTCOffset: '+04:00', UTCDSTOffset: '+04:00' },
    { code: 'IR', latLon: '8666', tz: 'Asia/Tehran', UTCOffset: '+03:30', UTCDSTOffset: '+04:30' },
    { code: 'BT', latLon: '11667', tz: 'Asia/Thimphu', UTCOffset: '+06:00', UTCDSTOffset: '+06:00' },
    { code: 'JP', latLon: '1748357', tz: 'Asia/Tokyo', UTCOffset: '+09:00', UTCDSTOffset: '+09:00' },
    { code: 'RU', latLon: '14088', tz: 'Asia/Tomsk', UTCOffset: '+07:00', UTCDSTOffset: '+07:00' },
    { code: 'MN', latLon: '15408', tz: 'Asia/Ulaanbaatar', UTCOffset: '+08:00', UTCDSTOffset: '+08:00' },
    { code: 'CN', latLon: '13083', tz: 'Asia/Urumqi', UTCOffset: '+06:00', UTCDSTOffset: '+06:00' },
    { code: 'RU', latLon: '2074673', tz: 'Asia/Ust-Nera', UTCOffset: '+10:00', UTCDSTOffset: '+10:00' },
    { code: 'RU', latLon: '17466', tz: 'Asia/Vladivostok', UTCOffset: '+10:00', UTCDSTOffset: '+10:00' },
    { code: 'RU', latLon: '19140', tz: 'Asia/Yakutsk', UTCOffset: '+09:00', UTCDSTOffset: '+09:00' },
    { code: 'MM', latLon: '11257', tz: 'Asia/Yangon', UTCOffset: '+06:30', UTCDSTOffset: '+06:30' },
    { code: 'RU', latLon: '11687', tz: 'Asia/Yekaterinburg', UTCOffset: '+05:00', UTCDSTOffset: '+05:00' },
    { code: 'AM', latLon: '8441', tz: 'Asia/Yerevan', UTCOffset: '+04:00', UTCDSTOffset: '+04:00' },
    { code: 'PT', latLon: '+3744-02540', tz: 'Atlantic/Azores', UTCOffset: '-01:00', UTCDSTOffset: '+00:00' },
    { code: 'BM', latLon: '+3217-06446', tz: 'Atlantic/Bermuda', UTCOffset: '-04:00', UTCDSTOffset: '-03:00' },
    { code: 'ES', latLon: '+2806-01524', tz: 'Atlantic/Canary', UTCOffset: '+00:00', UTCDSTOffset: '+01:00' },
    { code: 'CV', latLon: '+1455-02331', tz: 'Atlantic/Cape_Verde', UTCOffset: '-01:00', UTCDSTOffset: '-01:00' },
    { code: 'FO', latLon: '+6201-00646', tz: 'Atlantic/Faroe', UTCOffset: '+00:00', UTCDSTOffset: '+01:00' },
    { code: 'PT', latLon: '+3238-01654', tz: 'Atlantic/Madeira', UTCOffset: '+00:00', UTCDSTOffset: '+01:00' },
    { code: 'IS', latLon: '+6409-02151', tz: 'Atlantic/Reykjavik', UTCOffset: '+00:00', UTCDSTOffset: '+00:00' },
    { code: 'GS', latLon: '-5416-03632', tz: 'Atlantic/South_Georgia', UTCOffset: '-02:00', UTCDSTOffset: '-02:00' },
    { code: 'FK', latLon: '-5142-05751', tz: 'Atlantic/Stanley', UTCOffset: '-03:00', UTCDSTOffset: '-03:00' },
    { code: 'AU', latLon: '-3455+13835', tz: 'Australia/Adelaide', UTCOffset: '+09:30', UTCDSTOffset: '+10:30' },
    { code: 'AU', latLon: '-2728+15302', tz: 'Australia/Brisbane', UTCOffset: '+10:00', UTCDSTOffset: '+10:00' },
    { code: 'AU', latLon: '-3157+14127', tz: 'Australia/Broken_Hill', UTCOffset: '+09:30', UTCDSTOffset: '+10:30' },
    { code: 'AU', latLon: '-3956+14352', tz: 'Australia/Currie', UTCOffset: '+10:00', UTCDSTOffset: '+11:00' },
    { code: 'AU', latLon: '-1228+13050', tz: 'Australia/Darwin', UTCOffset: '+09:30', UTCDSTOffset: '+09:30' },
    { code: 'AU', latLon: '-3143+12852', tz: 'Australia/Eucla', UTCOffset: '+08:45', UTCDSTOffset: '+08:45' },
    { code: 'AU', latLon: '-4253+14719', tz: 'Australia/Hobart', UTCOffset: '+10:00', UTCDSTOffset: '+11:00' },
    { code: 'AU', latLon: '-2016+14900', tz: 'Australia/Lindeman', UTCOffset: '+10:00', UTCDSTOffset: '+10:00' },
    { code: 'AU', latLon: '-3133+15905', tz: 'Australia/Lord_Howe', UTCOffset: '+10:30', UTCDSTOffset: '+11:00' },
    { code: 'AU', latLon: '-3749+14458', tz: 'Australia/Melbourne', UTCOffset: '+10:00', UTCDSTOffset: '+11:00' },
    { code: 'AU', latLon: '-3157+11551', tz: 'Australia/Perth', UTCOffset: '+08:00', UTCDSTOffset: '+08:00' },
    { code: 'AU', latLon: '-3352+15113', tz: 'Australia/Sydney', UTCOffset: '+10:00', UTCDSTOffset: '+11:00' },
    { code: 'NL', latLon: '5676', tz: 'Europe/Amsterdam', UTCOffset: '+01:00', UTCDSTOffset: '+02:00' },
    { code: 'AD', latLon: '4361', tz: 'Europe/Andorra', UTCOffset: '+01:00', UTCDSTOffset: '+02:00' },
    { code: 'RU', latLon: '9424', tz: 'Europe/Astrakhan', UTCOffset: '+04:00', UTCDSTOffset: '+04:00' },
    { code: 'GR', latLon: '6101', tz: 'Europe/Athens', UTCOffset: '+02:00', UTCDSTOffset: '+03:00' },
    { code: 'RS', latLon: '6480', tz: 'Europe/Belgrade', UTCOffset: '+01:00', UTCDSTOffset: '+02:00' },
    { code: 'DE', latLon: '6552', tz: 'Europe/Berlin', UTCOffset: '+01:00', UTCDSTOffset: '+02:00' },
    { code: 'BE', latLon: '5470', tz: 'Europe/Brussels', UTCOffset: '+01:00', UTCDSTOffset: '+02:00' },
    { code: 'RO', latLon: '7032', tz: 'Europe/Bucharest', UTCOffset: '+02:00', UTCDSTOffset: '+03:00' },
    { code: 'HU', latLon: '6635', tz: 'Europe/Budapest', UTCOffset: '+01:00', UTCDSTOffset: '+02:00' },
    { code: 'MD', latLon: '7550', tz: 'Europe/Chisinau', UTCOffset: '+02:00', UTCDSTOffset: '+03:00' },
    { code: 'DK', latLon: '6775', tz: 'Europe/Copenhagen', UTCOffset: '+01:00', UTCDSTOffset: '+02:00' },
    { code: 'IE', latLon: '+5320-00615', tz: 'Europe/Dublin', UTCOffset: '+00:00', UTCDSTOffset: '+01:00' },
    { code: 'GI', latLon: '+3608-00521', tz: 'Europe/Gibraltar', UTCOffset: '+01:00', UTCDSTOffset: '+02:00' },
    { code: 'FI', latLon: '8468', tz: 'Europe/Helsinki', UTCOffset: '+02:00', UTCDSTOffset: '+03:00' },
    { code: 'TR', latLon: '6959', tz: 'Europe/Istanbul', UTCOffset: '+03:00', UTCDSTOffset: '+03:00' },
    { code: 'RU', latLon: '7473', tz: 'Europe/Kaliningrad', UTCOffset: '+02:00', UTCDSTOffset: '+02:00' },
    { code: 'UA', latLon: '8057', tz: 'Europe/Kiev', UTCOffset: '+02:00', UTCDSTOffset: '+03:00' },
    { code: 'RU', latLon: '10775', tz: 'Europe/Kirov', UTCOffset: '+03:00', UTCDSTOffset: '+03:00' },
    { code: 'PT', latLon: '+3843-00908', tz: 'Europe/Lisbon', UTCOffset: '+00:00', UTCDSTOffset: '+01:00' },
    { code: 'GB', latLon: '+513030-0000731', tz: 'Europe/London', UTCOffset: '+00:00', UTCDSTOffset: '+01:00' },
    { code: 'LU', latLon: '5545', tz: 'Europe/Luxembourg', UTCOffset: '+01:00', UTCDSTOffset: '+02:00' },
    { code: 'ES', latLon: '+4024-00341', tz: 'Europe/Madrid', UTCOffset: '+01:00', UTCDSTOffset: '+02:00' },
    { code: 'MT', latLon: '4985', tz: 'Europe/Malta', UTCOffset: '+01:00', UTCDSTOffset: '+02:00' },
    { code: 'BY', latLon: '8088', tz: 'Europe/Minsk', UTCOffset: '+03:00', UTCDSTOffset: '+03:00' },
    { code: 'MC', latLon: '5065', tz: 'Europe/Monaco', UTCOffset: '+01:00', UTCDSTOffset: '+02:00' },
    { code: 'RU', latLon: '928225', tz: 'Europe/Moscow', UTCOffset: '+03:00', UTCDSTOffset: '+03:00' },
    { code: 'CY', latLon: '6832', tz: 'Asia/Nicosia', UTCOffset: '+02:00', UTCDSTOffset: '+03:00' },
    { code: 'NO', latLon: '7000', tz: 'Europe/Oslo', UTCOffset: '+01:00', UTCDSTOffset: '+02:00' },
    { code: 'FR', latLon: '5072', tz: 'Europe/Paris', UTCOffset: '+01:00', UTCDSTOffset: '+02:00' },
    { code: 'CZ', latLon: '6431', tz: 'Europe/Prague', UTCOffset: '+01:00', UTCDSTOffset: '+02:00' },
    { code: 'LV', latLon: '8063', tz: 'Europe/Riga', UTCOffset: '+02:00', UTCDSTOffset: '+03:00' },
    { code: 'IT', latLon: '5383', tz: 'Europe/Rome', UTCOffset: '+01:00', UTCDSTOffset: '+02:00' },
    { code: 'RU', latLon: '10321', tz: 'Europe/Samara', UTCOffset: '+04:00', UTCDSTOffset: '+04:00' },
    { code: 'RU', latLon: '9736', tz: 'Europe/Saratov', UTCOffset: '+04:00', UTCDSTOffset: '+04:00' },
    { code: 'UA', latLon: '7863', tz: 'Europe/Simferopol', UTCOffset: '+03:00', UTCDSTOffset: '+03:00' },
    { code: 'BG', latLon: '6560', tz: 'Europe/Sofia', UTCOffset: '+02:00', UTCDSTOffset: '+03:00' },
    { code: 'SE', latLon: '7723', tz: 'Europe/Stockholm', UTCOffset: '+01:00', UTCDSTOffset: '+02:00' },
    { code: 'EE', latLon: '8370', tz: 'Europe/Tallinn', UTCOffset: '+02:00', UTCDSTOffset: '+03:00' },
    { code: 'AL', latLon: '6070', tz: 'Europe/Tirane', UTCOffset: '+01:00', UTCDSTOffset: '+02:00' },
    { code: 'RU', latLon: '10244', tz: 'Europe/Ulyanovsk', UTCOffset: '+04:00', UTCDSTOffset: '+04:00' },
    { code: 'UA', latLon: '7055', tz: 'Europe/Uzhgorod', UTCOffset: '+02:00', UTCDSTOffset: '+03:00' },
    { code: 'AT', latLon: '6433', tz: 'Europe/Vienna', UTCOffset: '+01:00', UTCDSTOffset: '+02:00' },
    { code: 'LT', latLon: '7960', tz: 'Europe/Vilnius', UTCOffset: '+02:00', UTCDSTOffset: '+03:00' },
    { code: 'RU', latLon: '9269', tz: 'Europe/Volgograd', UTCOffset: '+04:00', UTCDSTOffset: '+04:00' },
    { code: 'PL', latLon: '7315', tz: 'Europe/Warsaw', UTCOffset: '+02:00', UTCDSTOffset: '+03:00' },
    { code: 'UA', latLon: '8260', tz: 'Europe/Zaporozhye', UTCOffset: '+02:00', UTCDSTOffset: '+03:00' },
    { code: 'CH', latLon: '5555', tz: 'Europe/Zurich', UTCOffset: '+01:00', UTCDSTOffset: '+02:00' },
    { code: 'IO', latLon: '-0720+07225', tz: 'Indian/Chagos', UTCOffset: '+06:00', UTCDSTOffset: '+06:00' },
    { code: 'CX', latLon: '-1025+10543', tz: 'Indian/Christmas', UTCOffset: '+07:00', UTCDSTOffset: '+07:00' },
    { code: 'CC', latLon: '-1210+09655', tz: 'Indian/Cocos', UTCOffset: '+06:30', UTCDSTOffset: '+06:30' },
    { code: 'TF', latLon: '-492110+0701303', tz: 'Indian/Kerguelen', UTCOffset: '+05:00', UTCDSTOffset: '+05:00' },
    { code: 'SC', latLon: '-0440+05528', tz: 'Indian/Mahe', UTCOffset: '+04:00', UTCDSTOffset: '+04:00' },
    { code: 'MV', latLon: '7740', tz: 'Indian/Maldives', UTCOffset: '+05:00', UTCDSTOffset: '+05:00' },
    { code: 'MU', latLon: '-2010+05730', tz: 'Indian/Mauritius', UTCOffset: '+04:00', UTCDSTOffset: '+04:00' },
    { code: 'RE', latLon: '-2052+05528', tz: 'Indian/Reunion', UTCOffset: '+04:00', UTCDSTOffset: '+04:00' },
    { code: 'WS', latLon: '-1350-17144', tz: 'Pacific/Apia', UTCOffset: '+13:00', UTCDSTOffset: '+14:00' },
    { code: 'NZ', latLon: '-3652+17446', tz: 'Pacific/Auckland', UTCOffset: '+12:00', UTCDSTOffset: '+13:00' },
    { code: 'PG', latLon: '-0613+15534', tz: 'Pacific/Bougainville', UTCOffset: '+11:00', UTCDSTOffset: '+11:00' },
    { code: 'NZ', latLon: '-4357-17633', tz: 'Pacific/Chatham', UTCOffset: '+12:45', UTCDSTOffset: '+13:45' },
    { code: 'FM', latLon: '15872', tz: 'Pacific/Chuuk', UTCOffset: '+10:00', UTCDSTOffset: '+10:00' },
    { code: 'CL', latLon: '-2709-10926', tz: 'Pacific/Easter', UTCOffset: '-06:00', UTCDSTOffset: '-05:00' },
    { code: 'VU', latLon: '-1740+16825', tz: 'Pacific/Efate', UTCOffset: '+11:00', UTCDSTOffset: '+11:00' },
    { code: 'KI', latLon: '-0308-17105', tz: 'Pacific/Enderbury', UTCOffset: '+13:00', UTCDSTOffset: '+13:00' },
    { code: 'TK', latLon: '-0922-17114', tz: 'Pacific/Fakaofo', UTCOffset: '+13:00', UTCDSTOffset: '+13:00' },
    { code: 'FJ', latLon: '-1808+17825', tz: 'Pacific/Fiji', UTCOffset: '+12:00', UTCDSTOffset: '+13:00' },
    { code: 'TV', latLon: '-0831+17913', tz: 'Pacific/Funafuti', UTCOffset: '+12:00', UTCDSTOffset: '+12:00' },
    { code: 'EC', latLon: '-0054-08936', tz: 'Pacific/Galapagos', UTCOffset: '-06:00', UTCDSTOffset: '-06:00' },
    { code: 'PF', latLon: '-2308-13457', tz: 'Pacific/Gambier', UTCOffset: '-09:00', UTCDSTOffset: '-09:00' },
    { code: 'SB', latLon: '-0932+16012', tz: 'Pacific/Guadalcanal', UTCOffset: '+11:00', UTCDSTOffset: '+11:00' },
    { code: 'GU', latLon: '15773', tz: 'Pacific/Guam', UTCOffset: '+10:00', UTCDSTOffset: '+10:00' },
    { code: 'US', latLon: '+211825-1575130', tz: 'Pacific/Honolulu', UTCOffset: '-10:00', UTCDSTOffset: '-10:00' },
    { code: 'KI', latLon: '+0152-15720', tz: 'Pacific/Kiritimati', UTCOffset: '+14:00', UTCDSTOffset: '+14:00' },
    { code: 'FM', latLon: '16778', tz: 'Pacific/Kosrae', UTCOffset: '+11:00', UTCDSTOffset: '+11:00' },
    { code: 'MH', latLon: '17625', tz: 'Pacific/Kwajalein', UTCOffset: '+12:00', UTCDSTOffset: '+12:00' },
    { code: 'MH', latLon: '17821', tz: 'Pacific/Majuro', UTCOffset: '+12:00', UTCDSTOffset: '+12:00' },
    { code: 'PF', latLon: '-0900-13930', tz: 'Pacific/Marquesas', UTCOffset: '-09:30', UTCDSTOffset: '-09:30' },
    { code: 'NR', latLon: '-0031+16655', tz: 'Pacific/Nauru', UTCOffset: '+12:00', UTCDSTOffset: '+12:00' },
    { code: 'NU', latLon: '-1901-16955', tz: 'Pacific/Niue', UTCOffset: '-11:00', UTCDSTOffset: '-11:00' },
    { code: 'NF', latLon: '-2903+16758', tz: 'Pacific/Norfolk', UTCOffset: '+11:00', UTCDSTOffset: '+11:00' },
    { code: 'NC', latLon: '-2216+16627', tz: 'Pacific/Noumea', UTCOffset: '+11:00', UTCDSTOffset: '+11:00' },
    { code: 'AS', latLon: '-1416-17042', tz: 'Pacific/Pago_Pago', UTCOffset: '-11:00', UTCDSTOffset: '-11:00' },
    { code: 'PW', latLon: '14149', tz: 'Pacific/Palau', UTCOffset: '+09:00', UTCDSTOffset: '+09:00' },
    { code: 'PN', latLon: '-2504-13005', tz: 'Pacific/Pitcairn', UTCOffset: '-08:00', UTCDSTOffset: '-08:00' },
    { code: 'FM', latLon: '16471', tz: 'Pacific/Pohnpei', UTCOffset: '+11:00', UTCDSTOffset: '+11:00' },
    { code: 'PG', latLon: '-0930+14710', tz: 'Pacific/Port_Moresby', UTCOffset: '+10:00', UTCDSTOffset: '+10:00' },
    { code: 'CK', latLon: '-2114-15946', tz: 'Pacific/Rarotonga', UTCOffset: '-10:00', UTCDSTOffset: '-10:00' },
    { code: 'PF', latLon: '-1732-14934', tz: 'Pacific/Tahiti', UTCOffset: '-10:00', UTCDSTOffset: '-10:00' },
    { code: 'KI', latLon: '17425', tz: 'Pacific/Tarawa', UTCOffset: '+12:00', UTCDSTOffset: '+12:00' },
    { code: 'TO', latLon: '-2110-17510', tz: 'Pacific/Tongatapu', UTCOffset: '+13:00', UTCDSTOffset: '+14:00' },
    { code: 'UM', latLon: '18554', tz: 'Pacific/Wake', UTCOffset: '+12:00', UTCDSTOffset: '+12:00' },
    { code: 'WF', latLon: '-1318-17610', tz: 'Pacific/Wallis', UTCOffset: '+12:00', UTCDSTOffset: '+12:00' }
]
