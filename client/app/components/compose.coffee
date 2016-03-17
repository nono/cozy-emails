_          = require 'underscore'
classNames = require 'classnames'
React      = require 'react'
ReactDOM   = require 'react-dom'

{div, section, a, form, label, input} = React.DOM

ComposeEditor  = React.createFactory require './compose_editor'
ComposeToolbox = React.createFactory require './compose_toolbox'
FilePicker     = React.createFactory require './file_picker'
MailsInput     = React.createFactory require './mails_input'
AccountPicker  = React.createFactory require './account_picker'

AccountStore = require '../stores/account_store'
MessageStore = require '../stores/message_store'
LayoutStore = require '../stores/layout_store'

{ComposeActions, Tooltips} = require '../constants/app_constants'

MessageUtils = require '../utils/message_utils'

LayoutActionCreator  = require '../actions/layout_action_creator'
MessageActionCreator = require '../actions/message_action_creator'

RouterMixin      = require '../mixins/router_mixin'
LinkedStateMixin = require 'react-addons-linked-state-mixin'


# Component that allows the user to write emails.
module.exports = Compose = React.createClass
    displayName: 'Compose'


    mixins: [
        RouterMixin
        LinkedStateMixin
    ]


    propTypes:
        selectedAccountID:    React.PropTypes.string.isRequired
        selectedAccountLogin: React.PropTypes.string.isRequired
        layout:               React.PropTypes.string
        accounts:             React.PropTypes.object.isRequired
        message:              React.PropTypes.object
        action:               React.PropTypes.string
        callback:             React.PropTypes.func
        onCancel:             React.PropTypes.func
        settings:             React.PropTypes.object.isRequired
        useIntents:           React.PropTypes.bool.isRequired


    getDefaultProps: ->
        layout: 'full'

    getInitialState: ->
        @getStateFromStores()

    getStateFromStores: ->
        props = _.clone @props

        # Get Message
        unless props.message
            props.message = MessageStore.getByID props.messageID

        # Get Reply message
        if _.isString props.inReplyTo
            id = props.inReplyTo
            if (message = MessageStore.getByID id) and message.size
                message.set 'id', id
                props.inReplyTo = message
        MessageUtils.createBasicMessage props

    isNew: ->
        not @state.conversationID

    getChildKey: (name) ->
        'message-' + (@state.id or 'new') + '-' + name

    shouldComponentUpdate: (nextProps, nextState) ->
        not _.isEqual nextState, @state

    componentWillUpdate: (nextProps, nextState) ->
        unless _.isEmpty (text = nextState.text.trim())
            if nextProps.settings.get 'composeInHTML'
                nextState.html = MessageUtils.cleanHTML nextState.html
                nextState.text = MessageUtils.cleanReplyText nextState.html
                nextState.html = MessageUtils.wrapReplyHtml nextState.html

    # Update state with store values.
    _setStateFromStores: (message) ->
        isMessage = message?._id is @state.id
        isReplyTo = message?._id is @props.inReplyTo
        if not @isMounted() or (not isMessage and not isReplyTo)
            return

        _difference = (obj0, obj1) ->
            result = {}
            _.filter obj0, (value, key) ->
                unless _.isEqual value, obj1[key]
                    result[key] = value
            result

        nextState = @getStateFromStores()
        changes = _difference nextState, @state
        unless _.isEmpty changes
            @setState changes

    componentDidMount: ->
        # Listen to Stores changes
        MessageStore.addListener 'change', @_setStateFromStores

        # scroll compose window into view
        @refs.compose.scrollIntoView()

        # Save focus
        @addFocusListener()

        # Focus Element
        @handleFocus()

        # Each state:change do not send data to server
        # update date for client modifications
        @state.date = new Date().toISOString() unless @state.date
        @state.lastUpdate = @state.date unless @state.lastUpdate

    componentDidUpdate: ->
        # Initialize @state
        # with values from server
        @saveDraft() if @isNew()

        # Focus Element
        @handleFocus()

        # Each state:change do not send data to server
        # update date for client modifications
        @state.lastUpdate = new Date().toISOString()

    hasChanged: (props, state) ->
        @state.lastUpdate isnt @state.date

    resetChange: ->
        @state.lastUpdate = @state.date

    componentWillUnmount: ->
        MessageStore.removeListener 'change', @_setStateFromStores

        # Stop listening to focus
        @removeFocusListener()

        # Save Message into Draft
        @closeSaveDraft()

    handleFocus: ->
        return unless (path = LayoutStore.getFocus())

        if -1 < path.indexOf 'ref='
            # Element Focusable are not always
            # DOM form element :
            # It can be React Component
            ref = path.split('ref=')[1]
            element = ReactDOM.findDOMNode @refs[ref]

        else if (elements = ReactDOM.findDOMNode(@).querySelectorAll(path))
            element = elements[0]

        element.focus() if (element)


    saveFocus: (event) =>
        if event.refsPath
            path = 'ref=' + event.refsPath
        else if (name = event.currentTarget.name)
            path = '[name="' + event.currentTarget.name + '"]'
        LayoutActionCreator.focus path

    addFocusListener: ->
        _.each ['input[type="text"]', 'textarea'], (path) =>
            _.each ReactDOM.findDOMNode(@).querySelectorAll(path), (element) =>
                element.addEventListener 'focus', @saveFocus

        # Editor is a specific case
        if (editor = ReactDOM.findDOMNode @refs.editor)
            editor.addEventListener 'click', (event) =>
                @saveFocus refsPath: 'editor'

    removeFocusListener: ->
        _.each ['input[type="text"]', 'textarea'], (path) =>
            _.each ReactDOM.findDOMNode(@).querySelectorAll(path), (element) =>
                element.removeEventListener 'focus', @saveFocus

        # Editor is a specific case
        if (editor = ReactDOM.findDOMNode @refs.editor)
            editor.removeEventListener 'click', @saveFocus

    closeSaveDraft: ->
        fetch = =>
            # reload conversation to update its length
            if (cid = @state.conversationID)
                MessageActionCreator.fetchConversation cid

        save = =>
            MessageActionCreator.send _.clone(@state), (error, message) ->
                if error? or not message?
                    msg = "#{t "message action draft ko"} #{error}"
                    LayoutActionCreator.alertError msg
                    return

                fetch()

        # Fetch
        unless @hasChanged()
            fetch()
            return

        # Do not ask for save
        save()
        return

    render: ->
        closeUrl = @buildClosePanelUrl @props.layout

        classLabel = 'compose-label'
        classInput = 'compose-input'

        section
            ref: 'compose'
            className: classNames
                compose: true
                panel:   @props.layout is 'full'
            'aria-expanded': true,

            form className: 'form-compose', method: 'POST',
                div className: 'form-group account',
                    label
                        htmlFor: 'compose-from',
                        className: classLabel,
                        t "compose from"
                    AccountPicker
                        accounts: @props.accounts
                        valueLink: @linkState 'accountID'
                div className: 'clearfix', null

                div className: classInput,
                    div
                        className: 'btn-toolbar compose-toggle',
                        role: 'toolbar',
                            div null
                                a
                                    className: 'compose-toggle-cc',
                                    onClick: @toggleField,
                                    'data-ref': 'cc'
                                    t 'compose toggle cc'
                                a
                                    className: 'compose-toggle-bcc',
                                    onClick: @toggleField,
                                    'data-ref': 'bcc'
                                    t 'compose toggle bcc'

                MailsInput
                    id: 'compose-to'
                    valueLink: @linkState 'to'
                    label: t 'compose to'
                    ref: 'to'
                    key: @getChildKey 'to'

                MailsInput
                    id: 'compose-cc'
                    className: 'compose-cc'
                    valueLink: @linkState 'cc'
                    label: t 'compose cc'
                    placeholder: t 'compose cc help'
                    ref: 'cc'
                    key: @getChildKey 'cc'

                MailsInput
                    id: 'compose-bcc'
                    className: 'compose-bcc'
                    valueLink: @linkState 'bcc'
                    label: t 'compose bcc'
                    placeholder: t 'compose bcc help'
                    ref: 'bcc'
                    key: @getChildKey 'bcc'

                div className: 'form-group',
                    div className: classInput,
                        input
                            id: 'compose-subject'
                            name: 'compose-subject'
                            ref: 'subject'
                            valueLink: @linkState 'subject'
                            type: 'text'
                            className: 'form-control compose-subject'
                            placeholder: t "compose subject help"

                div className: 'compose-content',
                    ComposeEditor
                        id                : 'compose-editor'
                        messageID         : @state.id
                        html              : @linkState('html')
                        text              : @linkState('text')
                        accounts          : @props.accounts
                        accountID         : @state.accountID
                        settings          : @props.settings
                        onSend            : @sendMessage
                        composeInHTML     : @state.composeInHTML
                        getPicker         : @getPicker
                        useIntents        : @props.useIntents
                        ref               : 'editor'
                        key               : @getChildKey 'editor'

                div className: 'attachements',
                    FilePicker
                        className: ''
                        editable: true
                        valueLink: @linkState 'attachments'
                        ref: 'attachments'
                        key: @getChildKey 'attachments'

                ComposeToolbox
                    send      : @sendMessage
                    delete    : @deleteDraft
                    save      : @saveDraft
                    cancel    : @close
                    canDelete : @state.id?
                    ref       : 'toolbox'
                    key       : @getChildKey 'toolbox'

                div className: 'clearfix', null


    # If we are answering to a message, canceling should bring back to
    # this message.
    # The message URL requires many information: account ID, mailbox ID,
    # conversation ID and message ID. These infor are collected via current
    # selection and message information.
    finalRedirect: ->

        if @props.inReplyTo? and not _.isString @props.inReplyTo
            conversationID = @state.conversationID
            accountID = @props.selectedAccountID
            messageID = @state.id
            mailboxes = Object.keys @props.inReplyTo.get 'mailboxIDs'
            mailboxID = AccountStore.pickBestBox accountID, mailboxes

            @redirect
                firstPanel:
                    action: 'account.mailbox.messages'
                    parameters: {accountID, mailboxID}

                secondPanel:
                    action: 'conversation'
                    parameters: {conversationID, messageID}
            return

        # Else it should bring to the default view
        @redirect
            direction: 'first'
            action: 'account.mailbox.messages'
            fullWidth: true
            parameters: [
                @props.selectedAccountID
                @props.selectedMailboxID
            ]

    # Cancel brings back to default view.
    # If it's while replying to a message,
    # it brings back to this message.
    close: (event) ->
        # Action after cancelation: call @props.onCancel
        # or navigate to message list.
        if @props.onCancel?
            @props.onCancel()
        else
            @finalRedirect()

    showModal: (params, success) ->
        return if @isNew()

        doDelete = =>
            # Do not try to save client changes
            # After deleting message
            @resetChange()

            messageID = @state.id
            MessageActionCreator.delete {messageID}
            LayoutActionCreator.hideModal()

            if @props.callback
                @props.callback()
                return

            # specific callback
            success() if _.isFunction success

        _.extend params, action: doDelete
        LayoutActionCreator.displayModal params

    saveDraft: (event) ->
        event.preventDefault() if event?
        @state.isDraft = true
        @sendActionMessage =>
            @refs.toolbox.setState action: null if @refs.toolbox

    sendMessage: (event) ->
        event.preventDefault() if event?
        @state.isDraft = false

        @sendActionMessage (error, message) =>
            # Do not try to save client changes
            # after Sending message
            @resetChange()

            if error
                msgKo = t "message action sent ko"
                LayoutActionCreator.alertError "#{msgKo} #{error}"
                return

            # Display confirmation message
            # for no-draft email
            msgOk = t "message action sent ok"
            LayoutActionCreator.notify msgOk, autoclose: true

            @finalRedirect()

    validateMessage: ->
        return if @state.isDraft
        error = 'dest': ['to']
        getGroupedError error, @state, _.isEmpty

    sendActionMessage: (success) ->
        return if @state.isSaving
        if (validate = @validateMessage())
            LayoutActionCreator.alertError t 'compose error no ' + validate[1]
            success(null, @state) if _.isFunction success
            return

        _message = _.clone @state
        @state.isSaving = true
        MessageActionCreator.send _message, (error, message) =>
            delete @state.isSaving
            if error? or not message?
                if @state.isDraft
                    msgKo = t "message action draft ko"
                    LayoutActionCreator.alertError "#{msgKo} #{error}"

                success(error, message) if _.isFunction success
                return

            # Check for Updates
            @state.mailboxIDs = message.mailboxIDs
            @state.date = message.date
            @state.lastUpdate = message.date

            # Refresh URL
            # to save temporary info
            unless @state.id
                @state.id = message.id
                @state.conversationID = message.conversationID
                @redirect
                    action: 'compose.edit'
                    direction: 'first'
                    fullWidth: true
                    parameters:
                        messageID: @state.id
                return

            success(error, message) if _.isFunction success

    deleteDraft: (event) ->
        event.preventDefault() if event

        if _.isEmpty (subject = @state.subject)
            params = subject: subject
            confirmMessage = t 'mail confirm delete', params
        else
            confirmMessage = t 'mail confirm delete nosubject'

        @showModal
            title       : t 'mail confirm delete title'
            subtitle    : confirmMessage
            closeLabel  : t 'mail confirm delete cancel'
            actionLabel : t 'mail confirm delete delete'
        , @finalRedirect

    toggleField: (event) ->
        ref = event.currentTarget.getAttribute 'data-ref'
        view = @refs[ref]
        value = !view.state.focus

        view.setState focus: value

    # Get the file picker component (method used to pass it to the editor)
    getPicker: ->
        return @refs.attachments

getGroupedError = (error, message, test) ->
    type = null
    group = null
    _.find error, (properties, key) ->
        type = _.find properties, (property) ->
            test message[property]
        group = key if type?
        type
    if type or group then [type, group] else null
