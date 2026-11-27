using Cratis.Arc.MongoDB;

var builder = WebApplication.CreateBuilder(args);
builder.AddCratis(
    configureArcBuilder: arc => arc.WithMongoDB(configureMongoDB: mongo => mongo.WithCamelCaseNamingPolicy()),
    configureChronicleBuilder: chronicle => chronicle.WithCamelCaseNamingPolicy());
builder.Services.AddControllers();
var app = builder.Build();
app.UseRouting();
app.UseWebSockets();
app.MapControllers();
app.UseCratis();
await app.RunAsync();
