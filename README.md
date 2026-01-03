# Elite Convoys Booking System

A comprehensive Discord bot and web panel system for managing convoy control bookings in the Elite Convoys community. This system allows users to request convoy control supervision through Discord, while providing administrators with a web interface to manage bookings, configurations, and blackouts.

## Features

### Discord Bot Features
- **Booking Panel**: Interactive message with buttons for requesting convoy control, checking availability, and viewing personal requests
- **Modal Forms**: Step-by-step booking request forms with validation
- **Automatic Ticket Creation**: Creates dedicated Discord channels for each booking with appropriate permissions
- **Status Management**: Tracks booking statuses with visual indicators (🟡 Requested, ✅ Accepted, ❌ Declined/Cancelled, ✅ Completed)
- **Conflict Detection**: Automatically checks for scheduling conflicts and blackouts
- **Reminders**: Sends automated reminders to ticket channels before meetup times
- **Permission-Based Access**: Controls channel visibility based on user roles and booking status

### Web Panel Features
- **Dashboard**: Overview of all bookings with quick access to management
- **Booking Management**: Edit booking details, change statuses, and update information
- **Configuration Management**: Adjust default durations, buffers, review settings, and category prefixes
- **Blackout Management**: Schedule maintenance windows or unavailable periods
- **Role-Based Access**: Secure authentication via Discord OAuth with role-based permissions

### Booking Data Points
Each booking contains the following information:
- **VTC Name**: Virtual Trucking Company name
- **Event Date**: Date of the convoy (YYYY-MM-DD format)
- **Meetup Time**: Scheduled meetup time (HH:mm format)
- **Departure Time**: Actual departure time (HH:mm format)
- **Timezone**: Timezone for the event (currently fixed to UTC)
- **Server**: Game server where the convoy will take place
- **Start Location**: Starting point of the convoy
- **Destination**: End point of the convoy
- **DLCs Required**: Required DLCs for the route (or "None")
- **TMP Event Link**: Link to the TruckersMP event page
- **Other Notes**: Additional information or special requests
- **Status**: Current booking status
- **Requester Information**: Discord user ID and tag
- **Timestamps**: Creation and last update times
- **Ticket Channel**: Associated Discord channel ID and category

### Conflict Prevention
- **Buffer Times**: Configurable buffer periods before and after bookings to prevent overlaps
- **Blackout Periods**: Scheduled unavailable times that block new bookings
- **Automatic Review**: Option to require manual review for all bookings or auto-accept when no conflicts exist

### Permissions System
- **Requester**: Can view and message in their own ticket channels
- **Dispatch Staff**: Can view requested/review bookings and manage them
- **Convoy Control Staff**: Can view accepted bookings during active periods
- **Administrators**: Full access to setup commands and web panel

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd eliteconvoys-booking-system
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file with the following variables:
   ```env
   DISCORD_TOKEN=your_discord_bot_token
   GUILD_ID=your_discord_server_id
   OAUTH_CLIENT_ID=your_discord_oauth_client_id
   OAUTH_CLIENT_SECRET=your_discord_oauth_client_secret
   OAUTH_CALLBACK_URL=http://localhost:3000/auth/discord/callback
   WEB_PORT=3000
   SESSION_SECRET=your_random_session_secret
   WEB_ALLOWED_ROLE_IDS=role_id_1,role_id_2
   ROLE_DISPATCH_IDS=role_id_3,role_id_4
   ROLE_CCSTAFF_IDS=role_id_5
   ROLE_ONDUTY_IDS=role_id_6
   BOOKING_PANEL_CHANNEL_ID=channel_id_for_panel
   CATEGORY_PREFIX=📅
   DEFAULT_DURATION_MINUTES=180
   BUFFER_MINUTES=30
   REMINDER_MINUTES=60,30,15
   ```

4. **Start the application**:
   ```bash
   npm start
   ```

## Setup

1. **Invite the bot** to your Discord server with the following permissions:
   - View Channels
   - Send Messages
   - Use Slash Commands
   - Manage Channels
   - Manage Roles (for permission overwrites)
   - Read Message History
   - Embed Links

2. **Run the setup command**:
   Use `/setup-booking-panel` as an administrator to post the booking panel message.

3. **Configure roles**:
   Set the appropriate role IDs in your `.env` file for different permission levels.

4. **Access the web panel**:
   Visit `http://localhost:3000` and authenticate with Discord to access the management interface.

## Usage

### For Users
1. Click the "Request Convoy Control" button on the booking panel
2. Fill out the two-step modal form with your convoy details
3. Receive confirmation and a link to your dedicated ticket channel
4. Communicate with staff in the ticket channel for coordination

### For Staff
1. Monitor the web dashboard for new bookings
2. Review and approve/decline bookings as needed
3. Manage blackouts and configuration settings
4. Use ticket channels to coordinate with requesters

## Configuration Options

- **Default Duration**: Default length of convoy events in minutes
- **Buffer Minutes**: Time buffer before and after bookings to prevent conflicts
- **Review Enabled**: Whether bookings require manual review (1) or auto-accept (0)
- **Category Prefix**: Prefix for monthly category channels (e.g., "📅")
- **Reminder Minutes**: Comma-separated list of minutes before meetup to send reminders

## Database Structure

The system uses a JSON file (`data/db.json`) with the following structure:
- **bookings**: Array of booking objects
- **blackouts**: Array of blackout periods
- **config**: Guild-specific configuration settings
- **audit**: Log of system actions and changes

## Technologies Used

- **Node.js**: Runtime environment
- **Discord.js**: Discord bot framework
- **Express.js**: Web server framework
- **Passport.js**: Authentication middleware
- **LowDB**: JSON file database
- **Helmet**: Security middleware

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support or questions, please contact the development team or create an issue in the repository.</content>
<filePath="c:\Users\Administrator\Desktop\EliteConvoysBookingSystem\README.md